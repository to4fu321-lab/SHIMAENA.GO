"use client";

// 隊長トークの道具（spec v1.18・v1.33）: 文字の大きさ（標準／大／特大）と 🔊 読み上げ。どちらも端末に覚える。
// 読み上げ（v1.33）: 日本語のときは隊長のかわいい声（/api/voice → VOICEVOX の mp3 を、音の入れ物で鳴らす）。
// 声を作れないとき・日本語以外のときは、ブラウザの読み上げ（Web Speech、そのことばの声）。鍵も費用も要らない。
import { LANG_INFO, type Lang } from "@/lib/i18n/langs";
import { t } from "@/lib/i18n/ui";
import { getEngine, isUnlocked } from "@/lib/sound/engine";
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
/** 一度でも作れなかったら、この画面の間はブラウザの声にする（毎回失敗を待たない） */
let voiceAvailable: boolean | undefined;
let current: AudioBufferSourceNode | null = null;
let serial = 0;

/** いま鳴っている隊長の声を止める */
export function stopCaptainVoice(): void {
  serial++;
  try {
    current?.stop();
  } catch {
    /* もう止まっている */
  }
  current = null;
  if (canSpeak()) window.speechSynthesis.cancel();
}

async function playVoicevox(text: string): Promise<boolean> {
  if (voiceAvailable === false) return false;
  const e = getEngine();
  if (!e || !isUnlocked()) return false; // まだタップのない画面では鳴らせない（ブラウザの声も同じ）
  const my = ++serial;
  const res = await fetch(`/api/voice?text=${encodeURIComponent(text.slice(0, 200))}`).catch(() => null);
  if (!res || !res.ok) {
    if (res?.status === 404) voiceAvailable = false; // 切ってある
    return false;
  }
  const buf = await e.ctx.decodeAudioData(await res.arrayBuffer()).catch(() => null);
  if (!buf || my !== serial) return my !== serial; // 新しい読み上げが来ていたら、こちらは黙る（失敗ではない）
  voiceAvailable = true;
  const src = e.ctx.createBufferSource();
  src.buffer = buf;
  const gain = e.ctx.createGain();
  gain.gain.value = 1.1;
  src.connect(gain);
  gain.connect(e.master);
  current = src;
  src.onended = () => {
    if (current === src) current = null;
  };
  src.start();
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
    void playVoicevox(s).then((ok) => {
      if (!ok) speak(s, LANG_INFO.ja.speech);
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
