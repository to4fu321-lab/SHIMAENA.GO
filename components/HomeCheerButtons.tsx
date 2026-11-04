"use client";
// ホームの「📣 応援する」（いま自宅を雪かき中の人みんなへ）と「🍵 おつかれさま」（今日 自宅を終えた人みんなへ）。名前は出さない。
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
  if (working === 0 && finished === 0) return null;
  const send = (kind: "cheer" | "thanks") =>
    start(async () => {
      const fd = new FormData();
      fd.set("viewerId", viewerId);
      fd.set("kind", kind);
      const r = await sendCheerAction(fd);
      setDone((d) => ({ ...d, [kind]: r.sent }));
    });
  const btn = "flex min-h-11 flex-1 items-center justify-center gap-1 rounded-full px-2 text-sm font-bold shadow-sm ring-1 ring-ink/15 disabled:cursor-default";
  return (
    <div className="mt-1.5 flex gap-2" aria-label="自宅の雪かきへの応援">
      {working > 0 && (
        <button type="button" disabled={pending || cheer === 0 || done.cheer !== undefined} onClick={() => send("cheer")} className={`${btn} bg-warm`}>
          {done.cheer !== undefined || cheer === 0 ? `✓ 応援しました（${working}人）` : `📣 ${working}人を応援する`}
        </button>
      )}
      {finished > 0 && (
        <button type="button" disabled={pending || thanks === 0 || done.thanks !== undefined} onClick={() => send("thanks")} className={`${btn} bg-ice-soft`}>
          {done.thanks !== undefined || thanks === 0 ? `✓ おつかれさま済み（${finished}人）` : `🍵 ${finished}人におつかれさま`}
        </button>
      )}
    </div>
  );
}
