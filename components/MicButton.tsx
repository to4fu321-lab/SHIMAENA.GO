"use client";

// 隊長トークの音声入力（spec v1.18）: ブラウザの音声認識で、話した言葉を入力欄に入れる。送る前に直せる。
// 使えない端末（古いブラウザ・権限なし）ではボタンを出さず、キーボードのマイクを案内する。
// ことば（spec v1.36）: 選んだことばで聞き取る（既定は日本語）。
import { useEffect, useRef, useState } from "react";
import { LANG_INFO, type Lang } from "@/lib/i18n/langs";
import { t } from "@/lib/i18n/ui";
import { useClientValue } from "./useClientValue";

type Rec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecCtor = new () => Rec;

function recognizer(): RecCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}
const hasRecognizer = () => Boolean(recognizer());

export default function MicButton({ onText, disabled, lang = "ja" }: { onText: (text: string, final: boolean) => void; disabled?: boolean; lang?: Lang }) {
  const supported = useClientValue(false, hasRecognizer);
  const [listening, setListening] = useState(false);
  const [hint, setHint] = useState<string>();
  const rec = useRef<Rec | null>(null);
  useEffect(() => () => rec.current?.abort(), []);

  const start = () => {
    const Ctor = recognizer();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = LANG_INFO[lang].speech;
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let text = "";
      let final = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) final = true;
      }
      onText(text, final);
    };
    r.onend = () => setListening(false);
    r.onerror = (e) => {
      setListening(false);
      setHint(e.error === "not-allowed" ? t(lang, "micDenied") : t(lang, "micFailed"));
    };
    rec.current = r;
    setHint(undefined);
    setListening(true);
    r.start();
  };
  const stop = () => rec.current?.stop();

  if (!supported) return null;
  return (
    <>
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={disabled}
        aria-pressed={listening}
        aria-label={listening ? t(lang, "stopListening") : t(lang, "voiceInput")}
        className={`grid size-12 shrink-0 place-items-center rounded-full text-2xl ${listening ? "bg-lamp text-white animate-pulse" : "bg-ice-soft"}`}
      >
        🎤
      </button>
      {hint && <span className="sr-only" role="status">{hint}</span>}
    </>
  );
}
