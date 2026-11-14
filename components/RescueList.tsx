"use client";

// 「あと1人で救える家」と「10分だけ参加」（spec v1.1）。地図の下に出す。
import { useState, useTransition } from "react";
import { fiveMinutesAction, joinAction, type ActionResult } from "@/app/map/actions";
import type { ShortHouse } from "@/lib/morning/watch";
import { play } from "@/lib/sound/engine";
import { Chip, DistanceChip, NumberBadge, PeopleDots, SheetHead } from "./SheetBits";

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
        const r = await fn();
        setResult(r);
        play(r.ok ? "go" : "error");
      } catch (e) {
        setResult({ ok: false, text: e instanceof Error ? e.message : "うまくいきませんでした" });
        play("error");
      }
    });

  if (!isHelper) return null;
  const shown = items.slice(0, SHOW);

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="space-y-2" aria-label="人手が足りない家">
          <SheetHead icon="🆘">
            <span className="text-alert">助けを待っている家</span>
            <span className="ml-auto rounded-full bg-alert px-2 py-0.5 text-sm text-white">{items.length}軒</span>
          </SheetHead>
          <ul className="space-y-2">
            {shown.map((h) => (
              <li key={h.missionId} className="space-y-2 rounded-2xl bg-alert-soft px-3 py-2.5 ring-1 ring-alert/40">
                <div className="flex items-center gap-2.5">
                  <NumberBadge n={h.baseNumber} />
                  <div className="min-w-0 flex-1 leading-tight">
                    <p className="flex flex-wrap items-center gap-x-2">
                      <b className="text-lg">拠点{h.baseNumber}</b>
                      <PeopleDots going={h.going} required={h.required} />
                      <b className="text-base text-alert">あと{h.missing}人</b>
                    </p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      <DistanceChip m={h.distanceM} />
                      {h.tasks.slice(0, h.distanceM ? 1 : 2).map((t) => (
                        <Chip key={t}>⏱ 10分: {t.length > 12 ? `${t.slice(0, 12)}…` : t}</Chip>
                      ))}
                    </p>
                  </div>
                </div>
                {goingTo.includes(h.missionId) ? (
                  <p className="rounded-2xl bg-card px-3 py-2 text-center text-base font-bold ring-1 ring-ink/15">✓ 向かっています</p>
                ) : (
                  <button disabled={pending} onClick={() => run(() => joinAction(viewerId, h.missionId))} className="btn btn-lamp w-full text-lg">
                    拠点{h.baseNumber}に 10分だけ助けに行く
                  </button>
                )}
              </li>
            ))}
          </ul>
          {items.length > SHOW && <p className="text-center text-sm text-ink-soft">ほか {items.length - SHOW} 軒（地図の赤い番号）</p>}
        </div>
      )}
      {items.length === 0 && !hasAssignment && (
        <button disabled={pending} onClick={() => run(() => fiveMinutesAction(viewerId))} className="btn btn-lamp w-full text-lg">
          {pending ? "さがしています…" : "10分だけ参加する（偵察・補給）"}
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
