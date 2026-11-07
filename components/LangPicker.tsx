"use client";

// ことばの切りかえ（spec v1.36）: 隊長トークの上段の 🌐。押すと下から紙が出て、5つのことばから選ぶ。
// 選ぶと cookie に覚え（端末ごと）、隊長の吹き出しは Claude の訳で、画面の決まった文字は辞書で、そのことばになる。
import { useEffect, useState } from "react";
import { LANG_INFO, LANGS, type Lang } from "@/lib/i18n/langs";
import { t } from "@/lib/i18n/ui";

export default function LangPicker({ lang, onPick, canTranslate, voiceName }: { lang: Lang; onPick: (l: Lang) => void; canTranslate: boolean; voiceName?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={t(lang, "language")}
        className={`grid size-9 shrink-0 place-items-center rounded-full text-base ring-1 ring-ink/20 ${lang === "ja" ? "bg-card text-ink" : "bg-ink text-white"}`}
      >
        🌐
      </button>
      {open && (
        <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-ink/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={t(lang, "pickLanguage")} onClick={() => setOpen(false)}>
          <div className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-3xl bg-paper text-ink shadow-2xl" style={{ fontSize: 18, animation: "lang-rise 0.25s ease-out both" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-ink/20" aria-hidden="true" />
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-1 pt-1">
              <h2 className="text-xl font-bold">🌐 {t(lang, "pickLanguage")}</h2>
              <ul className="grid grid-cols-1 gap-2" aria-label={t(lang, "language")}>
                {LANGS.map((l) => (
                  <li key={l}>
                    <button
                      type="button"
                      aria-pressed={lang === l}
                      onClick={() => {
                        onPick(l);
                        setOpen(false);
                      }}
                      className={`flex min-h-12 w-full items-center justify-between rounded-2xl px-4 text-lg font-bold ring-1 ${lang === l ? "bg-ink text-white ring-ink" : "bg-card text-ink ring-ink/15"}`}
                    >
                      <span lang={LANG_INFO[l].speech}>{LANG_INFO[l].native}</span>
                      {lang === l && <span aria-hidden="true">✓</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-sm leading-snug text-ink-soft">{canTranslate ? t(lang, "translateNote") : t(lang, "noKeyNote")}</p>
              {voiceName && (
                <p className="text-sm leading-snug text-ink-soft">
                  {t(lang, "voiceNote")}: {voiceName}
                </p>
              )}
            </div>
            <div className="shrink-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-1">
              <button onClick={() => setOpen(false)} className="btn btn-white min-h-12 w-full text-lg">
                {t(lang, "close")}
              </button>
            </div>
          </div>
          <style>{`@keyframes lang-rise { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
        </div>
      )}
    </>
  );
}
