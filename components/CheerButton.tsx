"use client";

// 「町を応援する」と応援ゲージ（spec v1.3）。押したあとは SNS で広める・LINE で参加 へつなぐ。得点・羽には入れない。
import { useState, useTransition } from "react";
import { cheerTownAction } from "@/app/public/actions";
import { CHEER_GOAL, cheerPct } from "@/lib/public/cheer";
import { play } from "@/lib/sound/engine";

export default function CheerButton({ count: initial, already: initialAlready, compact = false }: { count: number; already: boolean; compact?: boolean }) {
  const [count, setCount] = useState(initial);
  const [already, setAlready] = useState(initialAlready);
  const [justNow, setJustNow] = useState(false);
  const [pending, start] = useTransition();

  const cheer = () =>
    start(async () => {
      const r = await cheerTownAction();
      setCount(r.count);
      setAlready(true);
      setJustNow(r.ok);
      if (r.ok) play("cheer");
    });

  return (
    <div className={compact ? "space-y-1" : "space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10"} aria-label="町の応援ゲージ">
      <div className="flex items-baseline justify-between">
        <p className={compact ? "text-sm font-bold" : "text-lg font-bold"}>今日の応援</p>
        <p className="text-sm text-ink-soft">
          <b className="text-xl tabular-nums text-ink">{count}</b> 人 / 目標 {CHEER_GOAL}
        </p>
      </div>
      <span className="block h-3 overflow-hidden rounded-full bg-ice-soft" aria-hidden="true">
        <span className="block h-full rounded-full bg-camellia transition-[width] duration-700" style={{ width: `${cheerPct(count)}%` }} />
      </span>
      <button
        disabled={pending || already}
        onClick={cheer}
        className={`btn btn-ink w-full ${compact ? "text-base" : "btn-big"}`}
      >
        {already ? "✓ 今日は応援しました" : pending ? "送っています…" : "町を応援する（登録なし・1日1回）"}
      </button>
      {justNow && (
        <p className="rounded-2xl bg-camellia-soft px-3 py-2 text-sm" role="status">
          ありがとう！応援は町のゲージに入ります（雪かきの完了や得点にはなりません）。
          <a href="#share" className="font-bold underline">
            SNS で広める
          </a>
          と、もっと仲間が増えます。
        </p>
      )}
      {!compact && <p className="text-sm text-ink-soft">応援は町のゲージに入ります。得点にはなりません。</p>}
    </div>
  );
}
