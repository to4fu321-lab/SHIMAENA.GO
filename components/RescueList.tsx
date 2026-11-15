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
  others = false,
}: {
  /** 次の1軒を下の大きなボタンに出しているとき: ここは「ほかの家」の一覧（軒数が地図の「人手不足」と食い違って見えないように。spec v1.59） */
  others?: boolean;
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
  // 1人が向かえるのは1軒（spec v1.59）: もう別の家に向かっているときは、切りかえるかを聞く
  const [swap, setSwap] = useState<{ missionId: string; to: number | string; from: number | string } | null>(null);
  const join = (h: ShortHouse, doSwap = false) =>
    start(async () => {
      try {
        const r = await joinAction(viewerId, h.missionId, doSwap);
        if (r.swap) {
          setResult(null);
          setSwap({ missionId: h.missionId, to: h.baseNumber, from: r.swap.from });
          play("tap");
          return;
        }
        setSwap(null);
        setResult(r);
        play(r.ok ? "go" : "error");
      } catch (e) {
        setResult({ ok: false, text: e instanceof Error ? e.message : "うまくいきませんでした" });
        play("error");
      }
    });
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
            <span className="text-alert">{others ? "ほかに助けを待っている家" : "助けを待っている家"}</span>
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
                ) : swap?.missionId === h.missionId ? (
                  <div className="space-y-2 rounded-2xl bg-card px-3 py-2.5 ring-2 ring-lamp" role="alertdialog" aria-label="向かう家を切りかえますか">
                    <p className="text-base font-bold leading-snug">
                      いま拠点{swap.from}に向かっています。向かえるのは1軒です。拠点{swap.to}に切りかえますか？
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button type="button" disabled={pending} onClick={() => setSwap(null)} className="btn btn-white text-base">
                        拠点{swap.from}のまま
                      </button>
                      <button type="button" disabled={pending} onClick={() => join(h, true)} className="btn btn-lamp text-base">
                        {pending ? "確認中…" : "切りかえる"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button disabled={pending} onClick={() => join(h)} className="btn btn-lamp w-full text-lg">
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
