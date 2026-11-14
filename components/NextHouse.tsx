"use client";

// 自分の雪かきが終わったあとの「次の家へ」の誘導（11/15 本人の指示「次の拠点へ行くへの誘導が弱い」）。
// 地図の下のシートのいちばん下に、完了のひとことと、次に助けを待っている家へ行く大きなボタンを1つ。
import { useState, useTransition } from "react";
import { joinAction, type ActionResult } from "@/app/map/actions";
import type { ShortHouse } from "@/lib/morning/watch";
import { play } from "@/lib/sound/engine";

export default function NextHouse({ viewerId, next, waiting }: { viewerId: string; next: ShortHouse; /** 助けを待っている家の数 */ waiting: number }) {
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
      <p className="text-center text-base font-bold leading-tight">
        ✓ 1軒 完了！ おつかれさまでした。
        <span className="block text-sm font-normal text-ink-soft">まだ {waiting}軒が待っています。もう1軒、行けますか？</span>
      </p>
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
