"use client";

// 報告箱（spec v1.33）: 「隊長に伝える」。種類（うまく動かない／こうしてほしい／意味が分からない）を1つ選び、文を書いて送る。
// 送ると隊長の返事がトークに入り、AI（点検ループ）が確かめて直す。直ったら隊長トークに知らせが届く。
// 置き場所: 隊長トークの上段（📮）と、設定の「お知らせ」。variant: icon = 丸い📮、wide = 幅いっぱいのボタン。
import Link from "next/link";
import { useState, useTransition } from "react";
import { sendFeedbackAction, type FeedbackResult } from "@/app/chat/feedback-actions";
import { KIND_LABEL, KIND_MARK, PICKABLE_KINDS, TEXT_MAX, type FeedbackKind } from "@/lib/feedback/rules";
import { play } from "@/lib/sound/engine";
import MicButton from "./MicButton";

const HINT: Record<FeedbackKind, string> = {
  bug: "例: 地図のボタンを押しても何も起きない",
  feature: "例: 文字をもっと大きくしたい",
  confusing: "例: 「出撃」が何のことか分からない",
  other: "",
};

export default function FeedbackButton({
  viewerId,
  page,
  variant = "wide",
  inChat = false,
  onSent,
  q = "",
}: {
  viewerId: string;
  /** 送ったときに開いていた画面（/chat など） */
  page: string;
  variant?: "icon" | "wide";
  /** 隊長トークの中から（返事をすぐ流れに出す） */
  inChat?: boolean;
  onSent?: (r: FeedbackResult) => void;
  /** デモの ?as= を引き継ぐ */
  q?: string;
}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>();
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string[]>();
  const [pending, start] = useTransition();

  const reset = () => {
    setKind(undefined);
    setText("");
    setError(undefined);
    setDone(undefined);
  };
  const close = () => {
    setOpen(false);
    reset();
  };
  const send = () => {
    if (!kind || text.trim().length < 2 || pending) return;
    setError(undefined);
    play("send");
    start(async () => {
      const r = await sendFeedbackAction(viewerId, kind, text, page, inChat).catch((): FeedbackResult => ({ ok: false }));
      if (!r.ok) {
        setError(r.text ?? "送れませんでした。もう一度どうぞ。");
        play("error");
        return;
      }
      play("confirm");
      setDone(r.reply ?? []);
      onSent?.(r);
    });
  };

  return (
    <>
      {variant === "icon" ? (
        <button type="button" onClick={() => setOpen(true)} aria-label="隊長に伝える（不具合・要望）" className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-base ring-1 ring-ink/20">
          📮
        </button>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="btn btn-white min-h-11 w-full text-base">
          📮 隊長に伝える（困った・要望）
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[700] flex items-end justify-center bg-ink/40" role="dialog" aria-modal="true" aria-label="隊長に伝える" onClick={close}>
          <section className="w-full max-w-md space-y-3 rounded-t-3xl bg-paper px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 text-ink shadow-xl" style={{ fontSize: 18 }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">📮 隊長に伝える</h2>
              <button type="button" onClick={close} aria-label="閉じる" data-sound="back" className="grid size-10 place-items-center rounded-full bg-card text-lg ring-1 ring-ink/15">
                ✕
              </button>
            </div>
            {done ? (
              <div className="space-y-3">
                <p className="rounded-2xl bg-card px-3 py-2 leading-snug shadow-sm">{done.join("\n")}</p>
                <p className="text-base text-ink-soft">AI が確かめて直します。直ったら隊長トークに知らせが届きます（数時間〜1日）。</p>
                {inChat ? (
                  <button type="button" onClick={close} className="btn btn-lamp btn-big w-full">
                    とじる
                  </button>
                ) : (
                  <Link href={`/chat${q}`} className="btn btn-lamp btn-big w-full" onClick={close}>
                    隊長トークで見る
                  </Link>
                )}
              </div>
            ) : (
              <>
                <p className="text-base text-ink-soft">うまく動かない・こうしてほしい・分からない。何でもどうぞ。AI が読んで直します（名前や住所は書かなくて大丈夫）。</p>
                <div role="radiogroup" aria-label="どんなこと？" className="grid grid-cols-3 gap-2">
                  {PICKABLE_KINDS.map((k) => (
                    <button
                      key={k}
                      type="button"
                      role="radio"
                      aria-checked={kind === k}
                      onClick={() => setKind(k)}
                      className={`flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 text-center text-sm font-bold leading-tight ring-1 ${kind === k ? "bg-ink text-white ring-ink" : "bg-card text-ink ring-ink/15"}`}
                    >
                      <span className="text-2xl" aria-hidden="true">
                        {KIND_MARK[k]}
                      </span>
                      {KIND_LABEL[k]}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={TEXT_MAX}
                    rows={3}
                    placeholder={listening ? "聞いています…" : kind ? HINT[kind] : "何があったか、ひとことで"}
                    aria-label="何があったか"
                    className="min-h-24 min-w-0 flex-1 resize-none rounded-2xl bg-card px-3 py-2 text-[1em] leading-snug ring-1 ring-ink/15 focus:outline-none focus:ring-2 focus:ring-lamp"
                  />
                  <MicButton
                    disabled={pending}
                    onText={(t, final) => {
                      setText(t);
                      setListening(!final);
                    }}
                  />
                </div>
                {error && <p className="text-base text-alert">{error}</p>}
                <button type="button" onClick={send} disabled={pending || !kind || text.trim().length < 2} className="btn btn-lamp btn-big w-full disabled:opacity-40">
                  {pending ? "送っています…" : "隊長に送る"}
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </>
  );
}
