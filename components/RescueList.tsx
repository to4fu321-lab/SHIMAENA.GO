"use client";

// 「あと1人で救える家」と「5分だけ参加」（spec v1.1）。地図の下に出す。
import { useState, useTransition } from "react";
import { fiveMinutesAction, joinAction, type ActionResult } from "@/app/map/actions";
import type { ShortHouse } from "@/lib/morning/watch";

const SHOW = 2;

export default function RescueList({
  viewerId,
  items,
  goingTo,
  isHelper,
  hasAssignment,
}: {
  viewerId: string;
  items: ShortHouse[];
  /** 自分がいま向かっているミッション */
  goingTo: string[];
  isHelper: boolean;
  /** 自分の割り当て（向かっている最中）があるか */
  hasAssignment: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      try {
        setResult(await fn());
      } catch (e) {
        setResult({ ok: false, text: e instanceof Error ? e.message : "うまくいきませんでした" });
      }
    });

  if (!isHelper) return null;
  const shown = items.slice(0, SHOW);

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="rounded-2xl bg-alert-soft px-3 py-3 ring-1 ring-alert/40" aria-label="人手が足りない家">
          <p className="text-base font-bold text-alert">！ {items[0].missing === 1 ? "あと1人で救える家" : "人手が足りない家"}</p>
          <ul className="mt-2 space-y-3">
            {shown.map((h) => (
              <li key={h.missionId} className="space-y-2">
                <div>
                  <p className="text-lg font-bold leading-tight">
                    拠点{h.baseNumber}　<span className="text-base font-normal">あと{h.missing}人（いま {h.going}人 / 必要 {h.required}人）</span>
                  </p>
                  <p className="text-sm text-ink-soft">5分でできる仕事: {h.tasks.join("／")}</p>
                </div>
                {goingTo.includes(h.missionId) ? (
                  <p className="rounded-2xl bg-card px-3 py-2 text-center text-base font-bold ring-1 ring-ink/15">✓ 向かっています</p>
                ) : (
                  <button disabled={pending} onClick={() => run(() => joinAction(viewerId, h.missionId))} className="btn btn-lamp w-full text-lg">
                    拠点{h.baseNumber}に 5分だけ助けに行く
                  </button>
                )}
              </li>
            ))}
          </ul>
          {items.length > SHOW && <p className="mt-1 text-sm text-ink-soft">ほか {items.length - SHOW} 軒</p>}
        </div>
      )}
      {items.length === 0 && !hasAssignment && (
        <button disabled={pending} onClick={() => run(() => fiveMinutesAction(viewerId))} className="btn btn-lamp w-full text-lg">
          {pending ? "さがしています…" : "5分だけ参加する（見回り・補給）"}
        </button>
      )}
      {result && (
        <p className={`rounded-2xl px-3 py-2 text-base ring-1 ${result.ok ? "bg-ice-soft ring-ice" : "bg-warm ring-lamp/50"}`} role="status">
          {result.ok ? "✓ " : "！ "}
          {result.text}
        </p>
      )}
    </div>
  );
}
