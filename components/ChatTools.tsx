"use client";

// 隊長トークの道具（spec v1.18）: 文字の大きさ（標準／大／特大）と 🔊 読み上げ。どちらも端末に覚える。
// 読み上げは Claude API ではなくブラウザの読み上げ（Web Speech、日本語の声）。鍵も費用も要らない。
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

/** 文を日本語の声で読む（前の読み上げは止める）。使えない端末では何もしない */
export function speak(text: string): void {
  if (!canSpeak() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[☃️🎉📷🔔💡🗺📍🪪🎓👟]/g, "").replace(/しま〜/g, "しまー").replace(/えな〜/g, "えなー"));
  u.lang = "ja-JP";
  u.rate = 0.95;
  const ja = synth.getVoices().find((v) => v.lang.startsWith("ja"));
  if (ja) u.voice = ja;
  synth.speak(u);
}

export default function ChatTools({ size, onSize, speakOn, onSpeak }: { size: TextSize; onSize: (s: TextSize) => void; speakOn: boolean; onSpeak: (on: boolean) => void }) {
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
    if (next) speak("読み上げをオンにしました。"); // 押した直後に1回読む（iPhone は最初の読み上げに「押す」が要る）
    else if (canSpeak()) window.speechSynthesis.cancel();
  };
  return (
    <div className="flex shrink-0 items-center gap-1" aria-label="文字の大きさと読み上げ">
      <div role="radiogroup" aria-label="文字の大きさ" className="flex overflow-hidden rounded-full bg-card ring-1 ring-ink/20">
        {(["m", "l", "xl"] as TextSize[]).map((s) => (
          <button
            key={s}
            role="radio"
            aria-checked={size === s}
            aria-label={s === "m" ? "標準" : s === "l" ? "大" : "特大"}
            onClick={() => pick(s)}
            className={`min-h-10 min-w-10 px-1 font-bold leading-none ${size === s ? "bg-ink text-white" : "text-ink"}`}
            style={{ fontSize: s === "m" ? 14 : s === "l" ? 17 : 20 }}
          >
            あ
          </button>
        ))}
      </div>
      {ok && (
        <button onClick={toggle} aria-pressed={speakOn} aria-label="読み上げ" className={`min-h-10 rounded-full px-2.5 text-sm font-bold ring-1 ring-ink/20 ${speakOn ? "bg-lamp text-white" : "bg-card text-ink"}`}>
          🔊 {speakOn ? "読み上げ中" : "読み上げ"}
        </button>
      )}
    </div>
  );
}
