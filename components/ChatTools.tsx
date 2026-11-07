"use client";

// 隊長トークの道具（spec v1.18・v1.36）: 文字の大きさ（標準／大／特大）と 🔊 読み上げ。どちらも端末に覚える。
// 読み上げ（v1.36）: 日本語のときは隊長のかわいい声（/api/voice → VOICEVOX の mp3 を、画面に1つの <audio> で鳴らす）。
// 声を作れないとき・日本語以外のときは、ブラウザの読み上げ（Web Speech、そのことばの声）。鍵も費用も要らない。
import { LANG_INFO, type Lang } from "@/lib/i18n/langs";
import { t } from "@/lib/i18n/ui";
import { useClientValue } from "./useClientValue";

export type TextSize = "m" | "l" | "xl";
export const TEXT_SIZE_PX: Record<TextSize, number> = { m: 18, l: 21, xl: 24 };
const SIZE_KEY = "shimaena-chat-text";
const SPEAK_KEY = "shimaena-chat-speak";

export function readTextSize(): TextSize {
  try {
    const v = localStorage.getItem(SIZE_KEY);
    return v === "l" || v === "xl" ? v : "m";
  } catch {
    return "m";
  }
}
export function readSpeak(): boolean {
  try {
    return localStorage.getItem(SPEAK_KEY) === "1";
  } catch {
    return false;
  }
}

/** この端末でブラウザの読み上げが使えるか */
export const canSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";

/** 文をブラウザの声で読む（前の読み上げは止める）。lang は BCP 47（既定は日本語）。使えない端末では何もしない */
export function speak(text: string, lang = "ja-JP"): void {
  if (!canSpeak() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[☃️🎉📷🔔💡🗺📍🪪🎓👟]/g, "").replace(/しま〜/g, "しまー").replace(/えな〜/g, "えなー"));
  u.lang = lang;
  u.rate = 0.95;
  const short = lang.slice(0, 2);
  const voice = synth.getVoices().find((v) => v.lang.startsWith(short));
  if (voice) u.voice = voice;
  synth.speak(u);
}

// ---- 隊長のかわいい声（VOICEVOX） ----
// 鳴らし方（11/7 本人の指摘「声でない」）: Web Audio ではなく、画面に1つの <audio> で /api/voice の mp3 を鳴らす。
// - iPhone はマナーモード（消音スイッチ）だと Web Audio の音を消すが、<audio> の再生は消さない
// - iPhone は「タップの中で一度 play() した <audio>」なら、あとから中身を変えても鳴らせる → primeCaptainVoice() をタップの中で呼ぶ
// - ブラウザの読み上げも、タップの中で一度話しておくと、あとから話せる（声を作れなかったときの代わり）
/** 一度でも「切ってある」と分かったら、この画面の間はブラウザの声にする */
let voiceAvailable: boolean | undefined;
let player: HTMLAudioElement | null = null;
let primed = false;
let serial = 0;

/** 0.05 秒の無音（WAV）。タップの中で鳴らして <audio> を使えるようにする */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA";

function getPlayer(): HTMLAudioElement | null {
  if (typeof window === "undefined" || typeof Audio === "undefined") return null;
  if (!player) {
    player = new Audio();
    player.preload = "auto";
    player.setAttribute("playsinline", "");
  }
  return player;
}

/**
 * タップの中で呼ぶ: <audio> とブラウザの読み上げを「鳴らしてよい」状態にする（iPhone 対策）。何度呼んでもよい
 */
export function primeCaptainVoice(): void {
  if (primed) return;
  const a = getPlayer();
  if (a) {
    try {
      a.src = SILENT_WAV;
      const p = a.play();
      primed = true;
      void p?.catch(() => {
        primed = false; // 次のタップでもう一度
      });
    } catch {
      /* 次のタップでもう一度 */
    }
  }
  if (canSpeak()) {
    try {
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch {
      /* 使えない端末 */
    }
  }
}

/** いま鳴っている隊長の声を止める */
export function stopCaptainVoice(): void {
  serial++;
  try {
    player?.pause();
  } catch {
    /* もう止まっている */
  }
  if (canSpeak()) window.speechSynthesis.cancel();
}

/** /api/voice の mp3 を <audio> で鳴らす。鳴り始めたら true、作れなかった（混んでいる・切ってある）ら false */
function playVoicevox(text: string): Promise<boolean> {
  const a = getPlayer();
  if (!a || voiceAvailable === false) return Promise.resolve(false);
  const my = ++serial;
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("error", onError);
      window.clearTimeout(timer);
      resolve(ok);
    };
    const onPlaying = () => {
      voiceAvailable = true;
      finish(true);
    };
    const onError = () => finish(my !== serial); // 新しい読み上げが来ていたら、こちらは黙る（失敗ではない）
    // 声ができるまで最大 15 秒待つ（サーバーは 12 秒であきらめる）
    const timer = window.setTimeout(() => finish(my !== serial), 15_000);
    a.addEventListener("playing", onPlaying);
    a.addEventListener("error", onError);
    a.src = `/api/voice?text=${encodeURIComponent(text.slice(0, 200))}`;
    a.volume = 1;
    void a.play().catch(() => finish(my !== serial));
  });
}

/**
 * 隊長の吹き出しを読む。日本語はかわいい声（VOICEVOX）、作れなければ／ほかのことばはブラウザの声。
 * 前の読み上げは止める
 */
export function speakCaptain(text: string, lang: Lang = "ja"): void {
  const s = text.trim();
  if (!s) return;
  stopCaptainVoice();
  if (lang === "ja" && voiceAvailable !== false) {
    const my = serial + 1;
    void playVoicevox(s).then((ok) => {
      if (!ok && my === serial) speak(s, LANG_INFO.ja.speech);
    });
    return;
  }
  speak(s, LANG_INFO[lang].speech);
}

export default function ChatTools({
  size,
  onSize,
  speakOn,
  onSpeak,
  lang = "ja",
}: {
  size: TextSize;
  onSize: (s: TextSize) => void;
  speakOn: boolean;
  onSpeak: (on: boolean) => void;
  lang?: Lang;
}) {
  const ok = useClientValue(false, canSpeak);
  const pick = (s: TextSize) => {
    onSize(s);
    try {
      localStorage.setItem(SIZE_KEY, s);
    } catch {}
  };
  const toggle = () => {
    primeCaptainVoice(); // タップの中で（iPhone はここで一度鳴らした <audio> だけを、あとから鳴らせる）
    const next = !speakOn;
    onSpeak(next);
    try {
      localStorage.setItem(SPEAK_KEY, next ? "1" : "0");
    } catch {}
    if (next) speakCaptain(t(lang, "readAloudOn"), lang); // 押した直後に1回読む（iPhone は最初の読み上げに「押す」が要る）
    else stopCaptainVoice();
  };
  const sizeLabel: Record<TextSize, string> = { m: t(lang, "sizeM"), l: t(lang, "sizeL"), xl: t(lang, "sizeXL") };
  return (
    <div className="flex shrink-0 items-center gap-1" aria-label={t(lang, "tools")}>
      <div role="radiogroup" aria-label={t(lang, "textSize")} className="flex overflow-hidden rounded-full bg-card ring-1 ring-ink/20">
        {(["m", "l", "xl"] as TextSize[]).map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={size === s}
            aria-label={sizeLabel[s]}
            onClick={() => pick(s)}
            className={`min-h-9 min-w-9 px-0.5 font-bold leading-none ${size === s ? "bg-ink text-white" : "text-ink"}`}
            style={{ fontSize: s === "m" ? 13 : s === "l" ? 16 : 19 }}
          >
            {lang === "ja" ? "あ" : "A"}
          </button>
        ))}
      </div>
      {ok && (
        <button onClick={toggle} aria-pressed={speakOn} aria-label={speakOn ? t(lang, "readingAloud") : t(lang, "readAloud")} className={`grid size-9 place-items-center rounded-full text-base ring-1 ring-ink/20 ${speakOn ? "bg-lamp text-white" : "bg-card text-ink"}`}>
          {speakOn ? "🔊" : "🔈"}
        </button>
      )}
    </div>
  );
}
