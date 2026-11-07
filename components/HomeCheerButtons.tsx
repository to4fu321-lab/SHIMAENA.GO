"use client";
// ホームの「📣 声かけ」ボタン（11/7 本人の指示「応援はタップでポップアップを出して、そこで選ぶ」）。
// 押すと下から紙が出て、「📣 応援する」（いま自宅を雪かき中の人みんなへ）と「🍵 おつかれさま」（今日 自宅を終えた人みんなへ）を選ぶ。名前は出さない。
import { useEffect, useState, useTransition } from "react";
import { sendCheerAction } from "@/app/home-actions";
import { play } from "@/lib/sound/engine";

export default function HomeCheerButtons({
  viewerId,
  cheer,
  thanks,
  working,
  finished,
}: {
  viewerId: string;
  /** まだ送っていない相手の数 */
  cheer: number;
  thanks: number;
  /** 相手の数（送ったあとも出す） */
  working: number;
  finished: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ cheer?: number; thanks?: number }>({});
  const send = (kind: "cheer" | "thanks") =>
    start(async () => {
      const fd = new FormData();
      fd.set("viewerId", viewerId);
      fd.set("kind", kind);
      const r = await sendCheerAction(fd);
      setDone((d) => ({ ...d, [kind]: r.sent }));
      play(kind === "cheer" ? "cheer" : "thanks");
    });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // まだ声をかけていない相手がいれば、ボタンに数の印を出す
  const waiting = (done.cheer === undefined ? cheer : 0) + (done.thanks === undefined ? thanks : 0);
  const cheerDone = done.cheer !== undefined || (working > 0 && cheer === 0);
  const thanksDone = done.thanks !== undefined || (finished > 0 && thanks === 0);
  const row = "flex min-h-16 w-full items-center gap-3 rounded-2xl px-4 text-left font-bold shadow-sm ring-1 ring-ink/15 disabled:opacity-60";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={waiting > 0 ? `声かけ（${waiting}人が待っています）` : "声かけ"}
        className="relative flex min-h-11 shrink-0 items-center gap-1 rounded-full bg-warm px-3 text-base font-bold shadow-sm ring-1 ring-ink/15"
      >
        <span aria-hidden="true">📣</span>声かけ
        {waiting > 0 && (
          <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-lamp px-1 text-xs text-white ring-2 ring-white tabular-nums">{waiting}</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-ink/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="声かけ" onClick={() => setOpen(false)}>
          <div
            className="w-full max-w-md space-y-3 rounded-t-3xl bg-paper px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2 text-ink shadow-2xl"
            style={{ fontSize: 18, animation: "cheer-rise 0.25s ease-out both" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto h-1.5 w-12 rounded-full bg-ink/20" aria-hidden="true" />
            <div className="leading-tight">
              <h2 className="text-2xl font-bold">📣 声かけ</h2>
              <p className="pt-1 text-base text-ink-soft">名前は出ません。ひと押しで、みんなに届きます。</p>
            </div>
            <button type="button" disabled={pending || working === 0 || cheerDone} onClick={() => send("cheer")} className={`${row} bg-warm`}>
              <span className="text-3xl" aria-hidden="true">📣</span>
              <span className="min-w-0 leading-tight">
                <span className="block text-lg">{cheerDone ? "✓ 応援しました" : "がんばれ！と応援する"}</span>
                <span className="block text-sm text-ink-soft">いま雪かき中 {working}人</span>
              </span>
            </button>
            <button type="button" disabled={pending || finished === 0 || thanksDone} onClick={() => send("thanks")} className={`${row} bg-ice-soft`}>
              <span className="text-3xl" aria-hidden="true">🍵</span>
              <span className="min-w-0 leading-tight">
                <span className="block text-lg">{thanksDone ? "✓ おつかれさま済み" : "おつかれさま と伝える"}</span>
                <span className="block text-sm text-ink-soft">今日 終えた人 {finished}人</span>
              </span>
            </button>
            <button type="button" onClick={() => setOpen(false)} className="btn btn-ink min-h-12 w-full text-lg">
              閉じる
            </button>
          </div>
          <style>{`@keyframes cheer-rise { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
        </div>
      )}
    </>
  );
}
