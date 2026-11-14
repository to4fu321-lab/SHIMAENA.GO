"use client";

// 自分の雪かきが終わったあとの「次の家へ」の誘導（spec v1.55・v1.56）。
// 地図の下のシートのいちばん下に、次の1軒（まだ人手が足りない家のうち、いちばん近い家）を番号の丸・距離・人がたで見せ、大きなボタンを1つ。
import { useState, useTransition } from "react";
import { joinAction, type ActionResult } from "@/app/map/actions";
import type { ShortHouse } from "@/lib/morning/watch";
import { play } from "@/lib/sound/engine";
import { DistanceChip, NumberBadge, PeopleDots } from "./SheetBits";

export default function NextHouse({ viewerId, next }: { viewerId: string; next: ShortHouse }) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const go = () =>
    start(async () => {
      try {
        const r = await joinAction(viewerId, next.missionId);
        setResult(r);
        play(r.ok ? "go" : "error");
      } catch (e) {
        setResult({ ok: false, text: e instanceof Error ? e.message : "うまくいきませんでした" });
        play("error");
      }
    });
  return (
    <div className="space-y-2" aria-label="次の家へ">
      <div className="flex items-center gap-2.5">
        <NumberBadge n={next.baseNumber} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-bold text-ink-soft">✓ 完了！ つぎは{next.distanceM ? " いちばん近くの家" : "この家"}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
            <b className="text-xl">拠点{next.baseNumber}</b>
            <PeopleDots going={next.going} required={next.required} />
            <DistanceChip m={next.distanceM} />
          </p>
        </div>
      </div>
      <button disabled={pending} onClick={go} className="btn btn-lamp btn-big w-full text-lg">
        {pending ? "確認中…" : `👉 次は 拠点${next.baseNumber} へ行く（あと${next.missing}人）`}
      </button>
      {result && (
        <p className={`rounded-2xl px-3 py-2 text-base ring-1 ${result.ok ? "bg-ice-soft ring-ice" : "bg-warm ring-lamp/50"}`} role="status">
          {result.ok ? "✓ " : "！ "}
          {result.text}
        </p>
      )}
    </div>
  );
}
