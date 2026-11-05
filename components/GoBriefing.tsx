"use client";

// 雪かきGO（出発前の画面）。割り当てが届いて、まだ「行く」を押していない人に、地図の下で
// ①準備の確認 ②今日の雪かき場所 ③活動のポイント ④出発する をひと目で見せる。
// 準備の確認は押して✓を付けるだけ（出発の条件にはしない。持ち物で参加のハードルを上げない）。
import { useState, useTransition } from "react";
import { goAction, type ActionResult } from "@/app/map/actions";
import type { Destination } from "@/lib/nav";
import type { Team } from "@/lib/types";
import Mascot from "./Mascot";

const GEAR: { key: string; label: string; icon: React.ReactNode }[] = [
  {
    key: "shovel",
    label: "スコップ",
    icon: (
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
        <path d="M27 5 L33 11 M30 8 L17 21" stroke="#29445c" strokeWidth="3" strokeLinecap="round" />
        <path d="M17 21 L21 25 L12 34 C9 37 4 32 7 29 Z" fill="#8fb8c9" stroke="#29445c" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "gloves",
    label: "手袋",
    icon: (
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
        <path d="M11 35 V20 C11 16 9 14 9 11 C9 9 12 8 13 11 L15 16 V8 C15 5 19 5 19 8 V15 V6 C19 3 23 3 23 6 V15 V8 C23 5 27 5 27 8 V16 V11 C27 8 31 8 31 11 V24 C31 30 27 35 22 35 Z" fill="#d9825b" stroke="#29445c" strokeWidth="2" strokeLinejoin="round" />
        <path d="M11 30 H29" stroke="#29445c" strokeWidth="2" />
      </svg>
    ),
  },
  {
    key: "coat",
    label: "防寒着",
    icon: (
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
        <path d="M14 5 L20 9 L26 5 L35 11 L32 20 L29 19 V36 H11 V19 L8 20 L5 11 Z" fill="#3b6584" stroke="#29445c" strokeWidth="2" strokeLinejoin="round" />
        <path d="M20 9 V36" stroke="#e3eef3" strokeWidth="2" />
        <path d="M11 24 H18 M22 24 H29" stroke="#8fb8c9" strokeWidth="2" />
      </svg>
    ),
  },
  {
    key: "phone",
    label: "スマホ",
    icon: (
      <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
        <rect x="11" y="4" width="18" height="32" rx="4" fill="#29445c" />
        <rect x="13.5" y="8" width="13" height="22" rx="1.5" fill="#8fb8c9" />
        <circle cx="20" cy="33" r="1.5" fill="#e3eef3" />
      </svg>
    ),
  },
];

export default function GoBriefing({
  viewerId,
  baseNumber,
  team,
  goingPeople,
  requiredPeople,
  request,
  destination,
  onLater,
}: {
  viewerId: string;
  baseNumber: number | string;
  team?: Team;
  goingPeople: number;
  requiredPeople: number;
  /** お願いした人からの締め切り・範囲（あれば） */
  request?: string;
  /** 行き先の道順（本人だけ） */
  destination?: Destination;
  /** 「あとで」: 出発前の案内を閉じて、ふつうの地図に戻る */
  onLater: () => void;
}) {
  const [checked, setChecked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const toggle = (k: string) => setChecked((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]));
  const go = () =>
    start(async () => {
      try {
        setResult(await goAction(viewerId));
      } catch (e) {
        setResult({ ok: false, text: e instanceof Error ? e.message : "うまくいきませんでした" });
      }
    });

  return (
    <section
      className="absolute inset-x-0 bottom-0 z-[600] space-y-2 rounded-t-3xl bg-card px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-6px_20px_rgba(41,68,92,0.18)]"
      aria-label="雪かきGO 出発前の確認"
      // 色は自分のチームの色（なければ冬の深い青）
      style={{ "--go": team?.color ?? "#29445c" } as React.CSSProperties}
    >
      {/* 見出し: 雪かきGO！ */}
      <div className="relative flex items-center gap-2 overflow-hidden rounded-2xl bg-[var(--go)] px-3 py-1.5 text-white">
        <Mascot size={52} team={team?.id} className="-my-1 shrink-0 [@media(max-height:720px)]:hidden" />
        <div className="min-w-0">
          <h2 className="text-2xl font-bold leading-tight">雪かきGO！</h2>
          <p className="text-sm leading-tight [@media(max-height:720px)]:hidden">拠点{baseNumber}へ、これから向かいます</p>
        </div>
      </div>

      {/* ① 準備の確認（押すと✓） */}
      <div>
        <p className="text-base font-bold">
          <span aria-hidden="true">☑ </span>準備を確認しましょう
          <span className="ml-1 text-xs font-normal text-ink-soft">押して✓</span>
        </p>
        <ul className="mt-1 grid grid-cols-4 gap-1.5">
          {GEAR.map((g) => {
            const on = checked.includes(g.key);
            return (
              <li key={g.key}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(g.key)}
                  className={`relative grid w-full place-items-center rounded-2xl py-1 text-sm font-bold ring-2 [@media(max-height:720px)]:py-2 transition-colors ${on ? "bg-ice-soft ring-[var(--go)]" : "bg-paper ring-ink/10"}`}
                >
                  <span className="[@media(max-height:720px)]:hidden">{g.icon}</span>
                  <span className="leading-tight">{g.label}</span>
                  {on && (
                    <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-[var(--go)] text-xs text-white" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ② 今日の雪かき場所 */}
      <div className="rounded-2xl bg-ice-soft px-3 py-2">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" className="shrink-0">
            <path d="M12 2 C7.6 2 5 5.3 5 8.8 C5 14 12 22 12 22 S19 14 19 8.8 C19 5.3 16.4 2 12 2 Z" fill="var(--go)" />
            <circle cx="12" cy="9" r="3" fill="#fff" />
          </svg>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-xs font-bold text-ink-soft">今日の雪かき場所</p>
            <p className="text-xl font-bold">拠点 {baseNumber}</p>
            <p className="text-sm font-bold">
              {team && (
                <>
                  <span className="mr-1 inline-block size-3 rounded-full align-middle" style={{ background: team.color }} aria-hidden="true" />
                  {team.name}・
                </>
              )}
              {goingPeople}/{requiredPeople}人・7:00〜
            </p>
          </div>
          {destination && (
            <a href={destination.mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-white min-h-11 shrink-0 px-3 text-sm">
              道順 ›
            </a>
          )}
        </div>
        {request && <p className="mt-1 text-sm">お願い: {request}</p>}
      </div>

      {/* ③ 活動のポイント */}
      <div className="rounded-2xl bg-warm px-3 py-1.5 ring-1 ring-lamp/40">
        <p className="text-sm font-bold">⚠ 活動のポイント<span className="hidden font-normal [@media(max-height:720px)]:inline">: 無理せず・2人以上で・終わったら写真</span></p>
        <ul className="list-disc pl-5 text-sm leading-snug [@media(max-height:720px)]:hidden">
          <li>無理をせず、休みながら</li>
          <li>チームの人と2人以上で</li>
          <li>終わったら「終わりました」で写真</li>
        </ul>
      </div>

      {/* ④ 出発する */}
      {result && (
        <p className="rounded-2xl bg-warm px-3 py-2 text-base ring-1 ring-lamp/50" role="status">
          {result.ok ? "✓ " : "！ "}{result.text}
        </p>
      )}
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button disabled={pending} onClick={go} className="btn btn-big w-full bg-[var(--go)] text-white shadow-md">
          {pending ? "送っています…" : "✓ 出発する"}
        </button>
        <button type="button" onClick={onLater} className="btn btn-white btn-big px-3 text-sm">
          あとで
        </button>
      </div>
    </section>
  );
}
