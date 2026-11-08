"use client";

// 隊長トークの道具（spec v1.18・v1.36）: 文字の大きさ（標準／大／特大）と 🔊 読み上げ。どちらも端末に覚える。
// 読み上げ（v1.36）: 日本語のときは隊長のかわいい声（/api/voice → VOICEVOX の mp3 を、画面に1つの <audio> で鳴らす）。
// 声を作れないとき・日本語以外のときは、ブラウザの読み上げ（Web Speech、そのことばの声）。鍵も費用も要らない。
import { LANG_INFO, type Lang } from "@/lib/i18n/langs";
import { t } from "@/lib/i18n/ui";
import { splitForVoice } from "@/lib/speech/split";
import Icon from "./Icon";
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

/** 隊長がブラウザの声で話すときの調子: 少し高く・少し速く（11/7 本人の指示「もっと元気な感じでかわいい声」） */
const CAPTAIN_TONE = { rate: 1.08, pitch: 1.35 } as const;

/** 文をブラウザの声で読む（前の読み上げは止める）。lang は BCP 47（既定は日本語）。使えない端末では何もしない */
export function speak(text: string, lang = "ja-JP", tone: { rate: number; pitch: number } = { rate: 0.95, pitch: 1 }): void {
  if (!canSpeak() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[☃️🎉📷🔔💡🗺📍🪪🎓👟]/g, "").replace(/しま〜/g, "しまー").replace(/えな〜/g, "えなー"));
  u.lang = lang;
  u.rate = tone.rate;
  u.pitch = tone.pitch;
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
  if (a && !a.paused) {
    primed = true; // もう鳴っている（声の途中）: 止めない
  } else if (a) {
    try {
      a.src = SILENT_WAV;
      const p = a.play();
      primed = true;
      void p?.catch((e: unknown) => {
        // 中身を替えて中断された（AbortError）のは「鳴らせた」のと同じ。許されなかったときだけ次のタップでもう一度
        if ((e as { name?: string })?.name === "NotAllowedError") primed = false;
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

/** 前に作った声の URL（端末の中の blob）。新しい声に替えたら捨てる */
let blobUrl: string | null = null;

/** 声を作るのを待つ長さ（サーバーは 25 秒であきらめる） */
const VOICE_FETCH_MS = 30_000;

/** /api/voice から1つ分の mp3 を丸ごと受け取る。作れなかったら null（status 404 は「切ってある」） */
async function fetchVoice(text: string): Promise<Blob | null> {
  const res = await fetch(`/api/voice?text=${encodeURIComponent(text.slice(0, 200))}`, { signal: AbortSignal.timeout(VOICE_FETCH_MS) }).catch(() => null);
  if (!res || !res.ok) {
    if (res?.status === 404) voiceAvailable = false;
    return null;
  }
  const blob = await res.blob().catch(() => null);
  return blob && blob.size > 0 ? blob : null;
}

/**
 * 受け取った mp3 を <audio> で最後まで鳴らす。鳴り始めたら true（鳴り終わるまで待つ）。
 * mp3 は端末の中の URL（blob）にしてから <audio> に渡す（11/7 本人の指摘「機械音しか出ない」）:
 * iPhone の Safari は <audio> にサーバーの URL を渡すと、ファイルを少しずつ分けて取りに行き、毎回作る新しい声ではあきらめていた
 */
function playBlob(a: HTMLAudioElement, blob: Blob, my: number): Promise<boolean> {
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = URL.createObjectURL(new Blob([blob], { type: "audio/mpeg" }));
  return new Promise((resolve) => {
    let started = false;
    let done = false;
    const finish = (ok: boolean) => {
      if (done) return;
      done = true;
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("error", onError);
      a.removeEventListener("pause", onEnded);
      window.clearTimeout(timer);
      resolve(ok);
    };
    const onPlaying = () => {
      started = true;
      voiceAvailable = true;
      window.clearTimeout(timer);
    };
    const onEnded = () => finish(started || my !== serial);
    const onError = () => finish(my !== serial);
    const timer = window.setTimeout(() => finish(my !== serial), 5_000); // 5 秒たっても鳴り始めない
    a.addEventListener("playing", onPlaying);
    a.addEventListener("ended", onEnded);
    a.addEventListener("error", onError);
    a.addEventListener("pause", onEnded); // 止められた（新しい読み上げ・オフ）
    a.src = blobUrl!;
    a.volume = 1;
    void a.play().catch(() => finish(my !== serial));
  });
}

/**
 * 隊長の声で読む。文は2つに分け（lib/speech/split.ts）、最初の短い部分ができたらすぐ鳴らし、残りはその間に作る
 * （11/7 本人の指摘「読み上げない」: 長い返事は声ができるまで 10 秒以上かかっていた）。
 * 最初の部分を鳴らせたら true。作れなかったら false（呼ぶ側がブラウザの声に回す）
 */
async function playVoicevox(text: string): Promise<boolean> {
  const a = getPlayer();
  if (!a || voiceAvailable === false) return false;
  const my = ++serial;
  const parts = splitForVoice(text);
  if (parts.length === 0) return true;
  let next: Promise<Blob | null> = fetchVoice(parts[0]);
  for (let i = 0; i < parts.length; i++) {
    const blob = await next;
    if (my !== serial) return true; // 新しい読み上げが来ていたら、こちらは黙る（失敗ではない）
    if (!blob) {
      // 最初の部分を作れなければ全部ブラウザの声へ。2つ目以降なら、残りだけをブラウザの声で読む（途中で黙らない）
      if (i > 0) speak(parts.slice(i).join(""), LANG_INFO.ja.speech, CAPTAIN_TONE);
      return i > 0;
    }
    if (i + 1 < parts.length) next = fetchVoice(parts[i + 1]); // 鳴らしている間に次を作る
    const ok = await playBlob(a, blob, my);
    if (my !== serial) return true;
    if (!ok) {
      if (i > 0) speak(parts.slice(i).join(""), LANG_INFO.ja.speech, CAPTAIN_TONE);
      return i > 0;
    }
  }
  return true;
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
      if (!ok && my === serial) speak(s, LANG_INFO.ja.speech, CAPTAIN_TONE);
    });
    return;
  }
  speak(s, LANG_INFO[lang].speech, CAPTAIN_TONE);
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
            className={`min-h-9 min-w-8 px-0.5 font-bold leading-none ${size === s ? "bg-ink text-white" : "text-ink"}`}
            style={{ fontSize: s === "m" ? 13 : s === "l" ? 16 : 19 }}
          >
            {lang === "ja" ? "あ" : "A"}
          </button>
        ))}
      </div>
      {ok && (
        <button onClick={toggle} aria-pressed={speakOn} aria-label={speakOn ? t(lang, "readingAloud") : t(lang, "readAloud")} className={`grid size-9 place-items-center rounded-full ring-1 ${speakOn ? "bg-ink text-white ring-ink" : "bg-card text-ink-soft ring-ink/20"}`}>
          {/* 線のアイコン（封筒・虫と同じ描き方）。オンは音の波をランプ色で */}
          <Icon name={speakOn ? "voice" : "voiceOff"} size={22} accent={speakOn ? "var(--color-lamp)" : undefined} />
        </button>
      )}
    </div>
  );
}
