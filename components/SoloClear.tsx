"use client";

// ソロ出動の完了演出（spec v1.3）。羽が舞い、入った羽・連続出動・カード・ひとことを見せる。
import Link from "next/link";
import type { SoloClearSummary } from "@/lib/solo/ops";

const FEATHERS = [
  { left: 6, delay: 0, color: "#8fd3ff" },
  { left: 18, delay: 0.5, color: "#ff8ab5" },
  { left: 31, delay: 0.2, color: "#cdbaff" },
  { left: 44, delay: 0.9, color: "#ffd400" },
  { left: 57, delay: 0.3, color: "#8fd3ff" },
  { left: 70, delay: 0.7, color: "#ff8ab5" },
  { left: 83, delay: 0.1, color: "#ffffff" },
  { left: 93, delay: 0.6, color: "#cdbaff" },
];

function Feather({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 40" width="18" height="30" aria-hidden="true">
      <path d="M12 1 C21 10 21 28 12 39 C3 28 3 10 12 1Z" fill={color} opacity="0.9" />
      <path d="M12 6 V36" stroke="#fff" strokeWidth="1.4" />
    </svg>
  );
}

export default function SoloClear({ summary, onClose, q, children }: { summary: SoloClearSummary; onClose: () => void; q: string; children?: React.ReactNode }) {
  const s = summary;
  const bonus = s.bonuses.reduce((a, b) => a + b.feathers, 0);
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-ink/60 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-label="ソロ出動 完了">
      <div className="relative max-h-[calc(100dvh-24px)] w-full max-w-sm overflow-y-auto overflow-x-hidden rounded-3xl bg-paper p-5 text-ink shadow-2xl">
        <div className="feathers pointer-events-none absolute inset-0" aria-hidden="true">
          {FEATHERS.map((f, i) => (
            <span key={i} className="feather" style={{ left: `${f.left}%`, animationDelay: `${f.delay}s` }}>
              <Feather color={f.color} />
            </span>
          ))}
        </div>
        <p className="text-center text-xs font-bold tracking-[0.3em] text-neon">SOLO CLEAR</p>
        <h2 className="mt-1 text-center text-2xl font-bold">{s.label}</h2>
        {s.firstEver && (
          <p className="mt-2 rounded-2xl bg-[#fff6c8] px-3 py-2 text-center text-base font-bold">
            初出撃おめでとう！今日からあなたも、しらかば町内の群れの一員です。
          </p>
        )}
        <p className="mt-3 text-center">
          <span className="text-5xl font-bold text-neon">+{s.feathers}</span>
          <span className="text-xl font-bold"> 羽</span>
          {bonus > 0 && <span className="ml-2 rounded-full bg-[#ffd400] px-2 py-0.5 text-sm font-bold">ごほうび +{bonus}</span>}
        </p>
        {s.bonuses.length > 0 && (
          <ul className="mt-1 text-center text-sm text-ink/80">
            {s.bonuses.map((b) => (
              <li key={b.label}>
                ★ {b.label} +{b.feathers}羽
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-2xl bg-white px-2 py-2 ring-1 ring-ink/10">
            <p className="text-ink/60">今日</p>
            <p className="text-xl font-bold tabular-nums">{s.todayFeathers}羽</p>
          </div>
          <div className="rounded-2xl bg-white px-2 py-2 ring-1 ring-ink/10">
            <p className="text-ink/60">連続</p>
            <p className="text-xl font-bold tabular-nums">{s.streak}日</p>
          </div>
          <div className="rounded-2xl bg-white px-2 py-2 ring-1 ring-ink/10">
            <p className="text-ink/60">合計</p>
            <p className="text-xl font-bold tabular-nums">{s.totalFeathers}羽</p>
          </div>
        </div>
        {!s.onsite && <p className="mt-2 text-center text-xs text-ink/60">オンラインの確認は雪かき完了にはなりません。次は5分、外へ。</p>}
        {s.photoNote && <p className="mt-2 rounded-2xl bg-white px-3 py-2 text-sm ring-1 ring-ink/10">{s.photoNote}</p>}
        <p className="mt-3 rounded-2xl bg-[#fff0f6] px-3 py-2 text-center text-base">
          <span className="block text-xs font-bold tracking-widest text-neon">エナガ隊長から</span>
          {s.hitokoto}
        </p>
        {s.card ? (
          <div className="mt-3 overflow-hidden rounded-2xl bg-white ring-1 ring-ink/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/cards/${s.card.id}/front.svg`} alt={`${s.card.designName} のカード`} className="aspect-[600/840] w-full" />
            <p className="p-2 text-center text-sm font-bold">
              カード「{s.card.designName}」を獲得！
            </p>
          </div>
        ) : (
          <p className="mt-3 text-center text-sm text-ink/70">
            次のカード: <b>{s.nextCard.label}</b>
            <span className="block text-xs">{s.nextCard.hint}</span>
          </p>
        )}
        {s.nextMission && (
          <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-center text-base ring-1 ring-ink/10">
            次のおすすめ: <b>{s.nextMission}</b>（5分）
          </p>
        )}
        {children}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href={`/cards${q}`} className="rounded-2xl bg-white py-3 text-center text-base font-bold text-ink ring-2 ring-ink/15">
            カード帳
          </Link>
          <button onClick={onClose} className="rounded-2xl bg-ink py-3 text-base font-bold text-white">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
