"use client";
// いつも2つ出す（相手がいないときは「まだ0人」）。ホームの「📣 応援する」（いま自宅を雪かき中の人みんなへ）と「🍵 おつかれさま」（今日 自宅を終えた人みんなへ）。名前は出さない。
import { useState, useTransition } from "react";
import { sendCheerAction } from "@/app/home-actions";

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
  const [pending, start] = useTransition();
  const [done, setDone] = useState<{ cheer?: number; thanks?: number }>({});
  const send = (kind: "cheer" | "thanks") =>
    start(async () => {
      const fd = new FormData();
      fd.set("viewerId", viewerId);
      fd.set("kind", kind);
      const r = await sendCheerAction(fd);
      setDone((d) => ({ ...d, [kind]: r.sent }));
    });
  const btn = "flex min-h-11 min-w-0 flex-1 basis-0 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 text-sm font-bold shadow-sm ring-1 ring-ink/15 disabled:cursor-default";
  return (
    <div className="mt-1.5 flex gap-2" aria-label="自宅の雪かきへの応援">
      <button
        type="button"
        disabled={pending || working === 0 || cheer === 0 || done.cheer !== undefined}
        onClick={() => send("cheer")}
        className={`${btn} ${working === 0 ? "bg-paper text-ink/70" : "bg-warm"}`}
      >
        {working === 0
          ? "📣 応援 0人"
          : done.cheer !== undefined || cheer === 0
            ? `✓ 応援しました（${working}人）`
            : `📣 ${working}人を応援する`}
      </button>
      <button
        type="button"
        disabled={pending || finished === 0 || thanks === 0 || done.thanks !== undefined}
        onClick={() => send("thanks")}
        className={`${btn} ${finished === 0 ? "bg-paper text-ink/70" : "bg-ice-soft"}`}
      >
        {finished === 0
          ? "🍵 おつかれさま 0人"
          : done.thanks !== undefined || thanks === 0
            ? `✓ おつかれさま済み（${finished}人）`
            : `🍵 ${finished}人におつかれさま`}
      </button>
    </div>
  );
}
