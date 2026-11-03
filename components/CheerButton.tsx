"use client";

// 「町を応援する」と応援ゲージ（spec v1.3）。押したあとは SNS で広める・LINE で参加 へつなぐ。得点・羽には入れない。
import { useState, useTransition } from "react";
import { cheerTownAction } from "@/app/public/actions";
import { CHEER_GOAL, cheerPct } from "@/lib/public/cheer";

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
    });

  return (
    <div className={compact ? "space-y-1" : "space-y-2 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/10"} aria-label="町の応援ゲージ">
      <div className="flex items-baseline justify-between">
        <p className={compact ? "text-sm font-bold" : "text-lg font-bold"}>今日の応援</p>
        <p className="text-sm text-ink/70">
          <b className="text-lg tabular-nums text-neon">{count}</b> 人 / 目標 {CHEER_GOAL}
        </p>
      </div>
      <span className="block h-3 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
        <span className="block h-full rounded-full bg-[#ffb3d9] transition-[width] duration-700" style={{ width: `${cheerPct(count)}%` }} />
      </span>
      <button
        disabled={pending || already}
        onClick={cheer}
        className={`w-full rounded-2xl font-bold text-white active:scale-95 disabled:opacity-60 ${compact ? "min-h-12 bg-neon/90 text-base" : "min-h-14 bg-neon text-xl"}`}
      >
        {already ? "今日は応援しました ✓" : pending ? "…" : "町を応援する"}
      </button>
      {justNow && (
        <p className="rounded-2xl bg-[#fff0f6] px-3 py-2 text-sm" role="status">
          ありがとう！応援は町のゲージに入ります（雪かきの完了や得点にはなりません）。
          <a href="#share" className="font-bold underline">
            SNS で広める
          </a>
          と、もっと仲間が増えます。
        </p>
      )}
      {!compact && <p className="text-xs text-ink/50">登録なしで押せます。1日1回。</p>}
    </div>
  );
}
