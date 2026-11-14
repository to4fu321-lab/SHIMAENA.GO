"use client";

// 1軒ずつの完了の、軽い知らせ（spec v1.57。前は MISSION CLEAR の重ね画面）。地図の上に数秒だけ出て消える。
// 点はここでは出さない。まとめて見せるのは「今日はここまで！」（DayClear）。
import { useEffect } from "react";
import type { ClearSummary } from "@/lib/morning/clear";
import { TEAMS } from "@/lib/teams";
import { play } from "@/lib/sound/engine";

export default function ClearToast({ clear, onClose, ms = 4500 }: { clear: ClearSummary; onClose: () => void; ms?: number }) {
  useEffect(() => {
    play(clear.mine ? "lamp" : "toast");
    const t = setTimeout(onClose, ms);
    return () => clearTimeout(t);
  }, [clear, onClose, ms]);
  const team = TEAMS.find((t) => t.id === clear.teamIds[0]);
  const who = clear.members.length > 1 ? `${clear.members[0]}さんたち` : clear.members[0] ? `${clear.members[0]}さん` : "";
  return (
    <button
      type="button"
      onClick={onClose}
      className="toast-in fixed inset-x-3 top-[max(12px,env(safe-area-inset-top))] z-[1200] mx-auto flex max-w-sm items-center gap-2.5 rounded-2xl bg-card px-3 py-2.5 text-left shadow-xl ring-2"
      style={{ "--tw-ring-color": team?.color ?? "var(--ice)" } as React.CSSProperties}
      role="status"
      aria-label="完了の知らせ（押すと閉じる）"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-full text-lg font-bold text-white" style={{ background: team?.color ?? "var(--ice)" }} aria-hidden="true">
        ✓
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <b className="block text-lg">拠点{clear.baseNumber} に灯りがともりました</b>
        <span className="text-sm text-ink-soft">
          {clear.mine ? "おつかれさまでした！ 点は「今日はここまで！」でまとめて" : `${who}${team ? `（${team.name}）` : ""}`}
        </span>
      </span>
    </button>
  );
}
