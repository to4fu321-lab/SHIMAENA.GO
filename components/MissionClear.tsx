"use client";

// 雪かき完了の画面（spec v1.1 の MISSION CLEAR）。
// 「あなたの5分で、1軒が助かりました」を真ん中に。家の窓に灯りがともり、羽が舞う。点の内訳・チーム得点・雪の減りはその下に。
// 自分の「終わりました」のあとに出る。他の人の完了に気づいたとき（ClearWatcher）は数秒で自動で閉じる。
import { useEffect } from "react";
import type { ClearSummary } from "@/lib/morning/clear";
import { TEAMS } from "@/lib/teams";
import Mascot, { SnowTown } from "./Mascot";
import QuickShare from "./QuickShare";
import InviteDrafts from "./InviteDrafts";
import { clearMessage } from "@/lib/share-links";

const FEATHERS = [
  { left: 6, delay: 0, color: "#8fb8c9" },
  { left: 18, delay: 0.5, color: "#c8a7b8" },
  { left: 31, delay: 0.2, color: "#2F6FE4" },
  { left: 44, delay: 0.9, color: "#FF8A3D" },
  { left: 57, delay: 0.3, color: "#9B5DE5" },
  { left: 70, delay: 0.7, color: "#8fb8c9" },
  { left: 83, delay: 0.1, color: "#ffffff" },
  { left: 93, delay: 0.6, color: "#c8a7b8" },
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
  const people = clear.members.length;
  const who = clear.mine ? "あなた" : people > 1 ? "みんな" : clear.members[0] ? `${clear.members[0]}さん` : "あなた";

  return (
    // z-[1200]: Leaflet の地図（z-index 400〜1000）より手前に出す
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-ink/70 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-label="雪かき完了">
      <div className="relative max-h-[calc(100dvh-24px)] w-full max-w-sm overflow-y-auto overflow-x-hidden rounded-3xl bg-paper p-5 text-ink shadow-2xl">
        <div className="feathers pointer-events-none absolute inset-0" aria-hidden="true">
          {FEATHERS.map((f, i) => (
            <span key={i} className="feather" style={{ left: `${f.left}%`, animationDelay: `${f.delay}s` }}>
              <Feather color={f.color} />
            </span>
          ))}
        </div>

        {/* 喜ぶシマエナガと「あなたの5分で、1軒が助かりました！」（イメージの完了カード） */}
        <div className="relative -mx-5 -mt-5 overflow-hidden bg-gradient-to-b from-ice-soft to-paper px-4 pb-10 pt-5">
          <p className="eyebrow">雪かき 完了</p>
          <div className="flex items-center gap-2">
            <Mascot size={88} mood="happy" className="lamp-glow shrink-0" />
            <h2 className="whitespace-nowrap text-lg font-bold leading-snug">
              {who}の<span className="text-2xl">5分</span>で
              <br />
              <span className="text-3xl text-lamp-deep">1軒</span>が助かりました！
            </h2>
          </div>
          <SnowTown className="absolute inset-x-0 bottom-0 h-10 w-full" />
        </div>
        <p className="mt-2 text-center text-base">
          拠点{clear.baseNumber}の家に灯りがともりました。
          {clear.total > 0 && (
            <>
              <br />
              今朝 <b className="text-lg tabular-nums">{clear.done}</b> 軒目 / {clear.total} 軒
            </>
          )}
        </p>

        {clear.firstFlight && (
          <p className="mt-3 rounded-2xl bg-camellia-soft px-3 py-2 text-base font-bold ring-1 ring-camellia">
            初出撃おめでとう！ 今日からあなたも、町内の群れの一員です。最初のカードが届きます。
          </p>
        )}
        {people > 0 && <p className="mt-2 text-center text-sm text-ink-soft">来た人: {clear.members.map((m) => `${m}さん`).join("・")}</p>}
        {(clear.care || clear.snowTypeLabel) && (
          <p className="mt-2 rounded-2xl bg-warm px-3 py-2 text-base">
            {clear.snowTypeLabel && <span className="mr-2 rounded-full bg-ice-soft px-2 py-0.5 text-sm font-bold">{clear.snowTypeLabel}</span>}
            {clear.care}
          </p>
        )}

        {/* 町の変化: 雪の減り */}
        <div className="mt-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-ink/10">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-bold">{clear.snowName ? `今朝の雪『${clear.snowName}』` : "今朝の雪"}</span>
            <span className="shrink-0 tabular-nums">
              {clear.hpBefore} → <b>{clear.hpAfter}</b> / {clear.hpMax}
            </span>
          </div>
          <span className="relative mt-1 block h-3 overflow-hidden rounded-full bg-ice-soft">
            <span className="absolute inset-y-0 left-0 rounded-full bg-ice/40" style={{ width: `${pct(clear.hpBefore)}%` }} />
            <span
              className="absolute inset-y-0 left-0 rounded-full bg-ice hp-shrink"
              style={{ width: `${pct(clear.hpAfter)}%`, "--from": `${pct(clear.hpBefore)}%` } as React.CSSProperties}
            />
          </span>
          <p className="mt-1 text-sm">
            {clear.allDone ? (
              <b>{clear.defeatedAt ? `${clear.defeatedAt} ` : ""}今朝の家はすべて完了。町じゅうに灯りがともりました。</b>
            ) : (
              <>あと {clear.left} 軒で、今朝の雪はぜんぶどけられます。</>
            )}
          </p>
        </div>

        {/* 点の内訳とチームの得点（くわしく） */}
        <details className="mt-3 rounded-2xl bg-card px-4 py-3 ring-1 ring-ink/10">
          <summary className="flex min-h-10 cursor-pointer items-center justify-between text-base font-bold">
            <span>この家で入った点 <span className="text-sm font-normal text-ink-soft">▼ くわしく</span></span>
            <span className="tabular-nums">+{clear.totalPoints} 点</span>
          </summary>
          <ul className="mt-2 space-y-1 border-t border-ink/10 pt-2" aria-label="点の内訳">
            {clear.items.map((i) => (
              <li key={i.reason} className="flex items-baseline justify-between text-base">
                <span>
                  {i.label}
                  {i.count > 1 && <span className="text-ink-soft"> ×{i.count}</span>}
                </span>
                <b className="tabular-nums">+{i.points}</b>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            {teams.map((t) => (
              <span key={t.id} className="rounded-full bg-paper px-3 py-1 font-bold ring-2" style={{ "--tw-ring-color": t.color } as React.CSSProperties}>
                <span className="mr-1 inline-block size-3 rounded-full align-middle" style={{ background: t.color }} aria-hidden="true" />
                {t.name} {clear.teamTotals[t.id]} 点
              </span>
            ))}
            {clear.myPoints !== undefined && clear.myPoints > 0 && (
              <span className="rounded-full bg-paper px-3 py-1 font-bold ring-1 ring-ink/15">あなたの今朝 {clear.myPoints} 点</span>
            )}
          </div>
        </details>

        {/* 自分の完了なら、その場で X・LINE・Instagram に知らせられる */}
        {clear.mine && <QuickShare text={clearMessage("house")} image={`/api/share/today.png?v=${clear.done}`} />}
        {clear.mine && clear.invites && clear.invites.length > 0 && <InviteDrafts drafts={clear.invites} />}

        <button onClick={onClose} className="btn btn-ink btn-big mt-4 w-full">
          町の地図へ戻る
        </button>
      </div>
    </div>
  );
}
