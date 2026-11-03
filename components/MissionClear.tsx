"use client";

// MISSION CLEAR の画面（spec v1.1）。点の内訳・チーム得点・雪HPの減りを見せ、羽が舞う。
// 自分の「終わりました」のあとに出る。他の人の完了に気づいたとき（ClearWatcher）は数秒で自動で閉じる。
import { useEffect } from "react";
import type { ClearSummary } from "@/lib/morning/clear";
import { TEAMS } from "@/lib/teams";

const FEATHERS = [
  { left: 6, delay: 0, color: "#8fd3ff" },
  { left: 18, delay: 0.5, color: "#ff8ab5" },
  { left: 31, delay: 0.2, color: "#2F6FE4" },
  { left: 44, delay: 0.9, color: "#FF8A3D" },
  { left: 57, delay: 0.3, color: "#9B5DE5" },
  { left: 70, delay: 0.7, color: "#8fd3ff" },
  { left: 83, delay: 0.1, color: "#ffffff" },
  { left: 93, delay: 0.6, color: "#ff8ab5" },
];

function Feather({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 40" width="18" height="30" aria-hidden="true">
      <path d="M12 1 C21 10 21 28 12 39 C3 28 3 10 12 1Z" fill={color} opacity="0.9" />
      <path d="M12 6 V36" stroke="#fff" strokeWidth="1.4" />
    </svg>
  );
}

export default function MissionClear({ clear, onClose, autoCloseMs }: { clear: ClearSummary; onClose: () => void; autoCloseMs?: number }) {
  useEffect(() => {
    if (!autoCloseMs) return;
    const t = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(t);
  }, [autoCloseMs, onClose]);

  const pct = (v: number) => (clear.hpMax > 0 ? Math.max(0, Math.min(100, (v / clear.hpMax) * 100)) : 0);
  const teams = TEAMS.filter((t) => clear.teamIds.includes(t.id));

  return (
    // z-[1200]: Leaflet の地図（z-index 400〜1000）より手前に出す
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-ink/60 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-label="ミッション完了">
      <div className="relative max-h-[calc(100dvh-24px)] w-full max-w-sm overflow-y-auto overflow-x-hidden rounded-3xl bg-paper p-5 text-ink shadow-2xl">
        <div className="feathers pointer-events-none absolute inset-0" aria-hidden="true">
          {FEATHERS.map((f, i) => (
            <span key={i} className="feather" style={{ left: `${f.left}%`, animationDelay: `${f.delay}s` }}>
              <Feather color={f.color} />
            </span>
          ))}
        </div>

        <p className="text-xs font-bold tracking-[0.3em] text-neon">MISSION CLEAR</p>
        <h2 className="mt-1 text-3xl font-bold leading-tight">拠点{clear.baseNumber} 完了！</h2>
        {clear.firstFlight && (
          <p className="mt-2 rounded-2xl bg-[#fff3b0] px-3 py-2 text-base font-bold text-ink">
            初出撃おめでとう！ 今日からあなたも、町内の群れの一員です。最初のカードが届きます。
          </p>
        )}
        {clear.members.length > 0 && <p className="text-base text-ink/80">{clear.members.map((m) => `${m}さん`).join("・")}</p>}

        <ul className="mt-2 space-y-1 rounded-2xl bg-white px-4 py-3 ring-1 ring-ink/10" aria-label="点の内訳">
          {clear.items.map((i) => (
            <li key={i.reason} className="flex items-baseline justify-between text-base">
              <span>
                {i.label}
                {i.count > 1 && <span className="text-ink/60"> ×{i.count}</span>}
              </span>
              <b className="tabular-nums">+{i.points}</b>
            </li>
          ))}
          <li className="flex items-baseline justify-between border-t border-ink/10 pt-2 text-lg font-bold">
            <span>この家で</span>
            <span className="tabular-nums text-neon">+{clear.totalPoints} 点</span>
          </li>
        </ul>

        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {teams.map((t) => (
            <span key={t.id} className="rounded-full px-3 py-1 font-bold text-white" style={{ background: t.color }}>
              {t.name} {clear.teamTotals[t.id]} 点
            </span>
          ))}
          {clear.myPoints !== undefined && clear.myPoints > 0 && (
            <span className="rounded-full bg-white px-3 py-1 ring-1 ring-ink/15">あなたの今朝 {clear.myPoints} 点</span>
          )}
        </div>

        <div className="mt-2 rounded-2xl bg-white px-4 py-3 ring-1 ring-ink/10">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-bold">{clear.snowName ? `『${clear.snowName}』のHP` : "雪HP"}</span>
            <span className="tabular-nums">
              {clear.hpBefore} → <b>{clear.hpAfter}</b> / {clear.hpMax}
            </span>
          </div>
          <span className="relative mt-1 block h-3 overflow-hidden rounded-full bg-ink/10">
            <span className="absolute inset-y-0 left-0 rounded-full bg-snow/40" style={{ width: `${pct(clear.hpBefore)}%` }} />
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-snow hp-shrink"
              style={{ width: `${pct(clear.hpAfter)}%`, "--from": `${pct(clear.hpBefore)}%` } as React.CSSProperties}
            />
          </span>
          <p className="mt-1 text-sm text-ink/70">
            {clear.allDone ? (
              <b className="text-neon">討伐{clear.defeatedAt ? ` ${clear.defeatedAt}` : ""}！ 今朝の家はすべて完了</b>
            ) : (
              <>あと {clear.left} 軒</>
            )}
          </p>
        </div>

        <button onClick={onClose} className="mt-3 w-full rounded-2xl bg-ink py-4 text-lg font-bold text-white">
          地図へ戻る
        </button>
      </div>
    </div>
  );
}
