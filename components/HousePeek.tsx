"use client";

// 家の番号を押したときの札（spec v1.69）: 地図のピンか、下の「今朝の家」の番号を押すと、地図がその家に寄り、上にこの札が出る。
// 何人来ているか・雪かき中か・あと何人か。人手が足りない家なら、そのまま「10分だけ助けに行く」。
// 家の場所は 50m マスのまま（名前・住所は出さない）。
import { useState, useTransition } from "react";
import { joinAction, type ActionResult } from "@/app/map/actions";
import type { BaseView } from "@/lib/morning/view";
import type { ShortHouse } from "@/lib/morning/watch";
import { TEAMS } from "@/lib/teams";
import { play } from "@/lib/sound/engine";
import { Chip, DistanceChip, NumberBadge, PeopleDots } from "./SheetBits";

const LABEL: Record<BaseView["status"], string> = {
  open: "人を待っています",
  short: "人手が足りません",
  assigned: "人がそろいました（これから）",
  in_progress: "雪かき中",
  done: "完了",
  no_answer: "返事がありません（声かけ中）",
  none: "",
};

export default function HousePeek({
  number,
  view,
  short,
  mine,
  going,
  viewerId,
  canHelp,
  onClose,
}: {
  number: number | string;
  view: BaseView;
  /** 人手が足りない家なら、その中身（距離・10分の仕事） */
  short?: ShortHouse;
  /** 自分の担当の家 */
  mine: boolean;
  /** 自分がいま向かっている */
  going: boolean;
  viewerId: string;
  canHelp: boolean;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [swapFrom, setSwapFrom] = useState<number | string | null>(null);
  const team = TEAMS.find((t) => t.id === view.teams[0]);
  const done = view.status === "done";
  const working = view.status === "in_progress";
  const missing = Math.max(0, view.requiredPeople - view.goingPeople);
  const join = (swap = false) =>
    start(async () => {
      if (!short) return;
      try {
        const r = await joinAction(viewerId, short.missionId, swap);
        if (r.swap) {
          setSwapFrom(r.swap.from);
          play("tap");
          return;
        }
        setSwapFrom(null);
        setResult(r);
        play(r.ok ? "go" : "error");
      } catch (e) {
        setResult({ ok: false, text: e instanceof Error ? e.message : "うまくいきませんでした" });
        play("error");
      }
    });

  return (
    <div className="toast-in absolute inset-x-2 top-2 z-[650] rounded-2xl bg-card px-3 py-2.5 shadow-xl ring-2 ring-ink/15" role="dialog" aria-label={`拠点${number}のようす`}>
      <div className="flex items-center gap-2.5">
        <NumberBadge n={number} tone={done ? "done" : view.status === "short" ? "alert" : "ink"} color={done ? team?.color : undefined} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="flex flex-wrap items-center gap-x-2">
            <b className="text-xl">拠点{number}</b>
            {mine && <Chip tone="lamp">あなたの担当</Chip>}
          </p>
          <p className={`mt-0.5 text-base font-bold ${view.status === "short" ? "text-alert" : ""}`}>
            {done ? "✓ " : working ? "🧹 " : ""}
            {LABEL[view.status]}
          </p>
        </div>
        <button type="button" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-full text-xl font-bold text-ink-soft" aria-label="閉じる" data-sound="tap">
          ×
        </button>
      </div>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
        <PeopleDots going={view.goingPeople} required={view.requiredPeople} color={team?.color} />
        <span>
          {done ? `${view.goingPeople}人で終えました` : `いま ${view.goingPeople}人 / 必要 ${view.requiredPeople}人`}
          {!done && missing > 0 && <b className="ml-1 text-alert">あと{missing}人</b>}
        </span>
      </p>
      {(view.teams.length > 0 || short?.distanceM) && (
        <p className="mt-1 flex flex-wrap gap-1">
          {view.teams.map((id) => {
            const t = TEAMS.find((x) => x.id === id);
            return t ? (
              <Chip key={id}>
                <span className="inline-block size-2.5 rounded-full" style={{ background: t.color }} aria-hidden="true" />
                {t.name}
              </Chip>
            ) : null;
          })}
          <DistanceChip m={short?.distanceM} />
        </p>
      )}
      {short && canHelp && !done && (
        <div className="mt-2">
          {going ? (
            <p className="rounded-2xl bg-ice-soft px-3 py-2 text-center text-base font-bold ring-1 ring-ice">✓ 向かっています</p>
          ) : swapFrom !== null ? (
            <div className="space-y-2">
              <p className="text-base font-bold leading-snug">いま拠点{swapFrom}に向かっています。拠点{number}に切りかえますか？</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={pending} onClick={() => setSwapFrom(null)} className="btn btn-white text-base">
                  拠点{swapFrom}のまま
                </button>
                <button type="button" disabled={pending} onClick={() => join(true)} className="btn btn-lamp text-base">
                  {pending ? "確認中…" : "切りかえる"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" disabled={pending} onClick={() => join()} className="btn btn-lamp w-full text-lg">
              {pending ? "確認中…" : `拠点${number}に 10分だけ助けに行く`}
            </button>
          )}
        </div>
      )}
      {result && (
        <p className={`mt-2 rounded-2xl px-3 py-1.5 text-base ring-1 ${result.ok ? "bg-ice-soft ring-ice" : "bg-warm ring-lamp/50"}`} role="status">
          {result.ok ? "✓ " : "！ "}
          {result.text}
        </p>
      )}
    </div>
  );
}
