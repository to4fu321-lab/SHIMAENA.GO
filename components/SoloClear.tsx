"use client";

// ソロ出動の完了演出（spec v1.3）。羽が舞い、入った羽・連続出動・カード・ひとことを見せる。
import Link from "next/link";
import { useEffect, useState } from "react";
import type { SoloClearSummary } from "@/lib/solo/ops";
import Mascot, { SnowTown } from "./Mascot";
import CardReveal from "./CardReveal";

const FEATHERS = [
  { left: 6, delay: 0, color: "#8fb8c9" },
  { left: 18, delay: 0.5, color: "#c8a7b8" },
  { left: 31, delay: 0.2, color: "#f5eee5" },
  { left: 44, delay: 0.9, color: "#d9825b" },
  { left: 57, delay: 0.3, color: "#8fb8c9" },
  { left: 70, delay: 0.7, color: "#c8a7b8" },
  { left: 83, delay: 0.1, color: "#ffffff" },
  { left: 93, delay: 0.6, color: "#f5eee5" },
];

function Feather({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 40" width="18" height="30" aria-hidden="true">
      <path d="M12 1 C21 10 21 28 12 39 C3 28 3 10 12 1Z" fill={color} opacity="0.9" />
      <path d="M12 6 V36" stroke="#fff" strokeWidth="1.4" />
    </svg>
  );
}

/** 0 から数えあがる数字。数え終わると、ぽんと弾む */
function CountUp({ to, delay = 300, ms = 900 }: { to: number; delay?: number; ms?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (t: number) => {
      const k = reduce ? 1 : Math.min(1, Math.max(0, (t - t0) / ms));
      setN(Math.round(to * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, delay, ms]);
  return (
    <span key={n === to ? "done" : "run"} className={`inline-block tabular-nums ${n === to ? "count-pop" : ""}`}>
      {n}
    </span>
  );
}

export default function SoloClear({ summary, onClose, q, minutesLabel, children }: { summary: SoloClearSummary; onClose: () => void; q: string; minutesLabel?: string; children?: React.ReactNode }) {
  const s = summary;
  const bonus = s.bonuses.reduce((a, b) => a + b.feathers, 0);
  return (
    <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-ink/70 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-label="ソロ出動 完了">
      <div className="relative max-h-[calc(100dvh-24px)] w-full max-w-sm overflow-y-auto overflow-x-hidden rounded-3xl bg-paper p-5 text-ink shadow-2xl">
        <div className="feathers pointer-events-none absolute inset-0" aria-hidden="true">
          {FEATHERS.map((f, i) => (
            <span key={i} className="feather" style={{ left: `${f.left}%`, animationDelay: `${f.delay}s` }}>
              <Feather color={f.color} />
            </span>
          ))}
        </div>
        <div className="relative -mx-5 -mt-5 overflow-hidden bg-gradient-to-b from-ice-soft to-paper px-4 pb-10 pt-5">
          <p className="eyebrow">ソロ出動 完了</p>
          <div className="flex items-center gap-2">
            <Mascot size={88} mood="happy" className="lamp-glow shrink-0" />
            <h2 className="whitespace-nowrap text-lg font-bold leading-snug">
              あなたの<span className="text-2xl text-lamp-deep">{minutesLabel ?? (s.onsite ? "10分" : "3分")}</span>が、
              <br />
              町の力になりました！
            </h2>
          </div>
          <SnowTown className="absolute inset-x-0 bottom-0 h-10 w-full" />
        </div>
        <p className="mt-1 text-center text-base text-ink-soft">{s.label}</p>
        {s.firstEver && (
          <p className="mt-2 rounded-2xl bg-camellia-soft px-3 py-2 text-center text-base font-bold ring-1 ring-camellia">
            初出撃おめでとう！今日からあなたも、しらかば町内の群れの一員です。
          </p>
        )}
        <p className="mt-3 text-center">
          <span className="text-5xl font-bold text-camellia-deep">+<CountUp to={s.feathers} /></span>
          <span className="text-xl font-bold"> 羽</span>
          {bonus > 0 && <span className="ml-2 rounded-full bg-camellia-soft px-2 py-0.5 text-sm font-bold text-camellia-deep ring-1 ring-camellia">ごほうび +{bonus}</span>}
        </p>
        {s.teamPoints > 0 && (
          <p className="pop-late mt-1 text-center text-lg font-bold">
            {s.teamName ?? "チーム"} に <span className="text-2xl text-lamp-deep">+{s.teamPoints}点</span>
          </p>
        )}
        {s.snowKg !== undefined && s.snowKg > 0 && (
          <div className="pop-late mt-2 rounded-2xl bg-ice-soft px-3 py-2 text-center ring-1 ring-ice">
            <p className="text-sm font-bold">どけた雪 およそ</p>
            <p className="text-4xl font-bold tabular-nums text-ink">
              {s.snowKg}
              <span className="text-xl">kg</span>
            </p>
            <p className="text-base font-bold">{s.snowKgComparison}</p>
            {s.snowKgBasis && <p className="mt-1 text-xs text-ink-soft">推定: {s.snowKgBasis}</p>}
          </div>
        )}
        {s.teamCapped && <p className="text-center text-sm text-ink-soft">今日のソロのチーム得点は上限（15点）に届きました。羽はこのあともたまります。</p>}
        {!s.onsite && s.teamPoints === 0 && <p className="text-center text-sm text-ink-soft">アプリでの参加のチーム得点は、1日3点までです。</p>}
        {s.bonuses.length > 0 && (
          <ul className="mt-1 text-center text-sm text-ink-soft">
            {s.bonuses.map((b) => (
              <li key={b.label}>
                ★ {b.label} +{b.feathers}羽
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-2xl bg-card px-2 py-2 ring-1 ring-ink/10">
            <p className="font-bold">今日</p>
            <p className="text-xl font-bold tabular-nums">{s.todayFeathers}羽</p>
          </div>
          <div className="rounded-2xl bg-card px-2 py-2 ring-1 ring-ink/10">
            <p className="font-bold">連続</p>
            <p className="text-xl font-bold tabular-nums">{s.streak}日</p>
          </div>
          <div className="rounded-2xl bg-card px-2 py-2 ring-1 ring-ink/10">
            <p className="font-bold">合計</p>
            <p className="text-xl font-bold tabular-nums">{s.totalFeathers}羽</p>
          </div>
        </div>
        {children}
        {!s.onsite && <p className="mt-2 text-center text-xs text-ink-soft">オンラインの確認は雪かき完了にはなりません。次は10分、外へ。</p>}
        {s.photoNote && <p className="mt-2 rounded-2xl bg-card px-3 py-2 text-sm ring-1 ring-ink/10">{s.photoNote}</p>}
        <p className="mt-3 rounded-2xl bg-warm px-3 py-2 text-center text-base">
          <span className="eyebrow block">シマエナ隊長から</span>
          {s.hitokoto}
        </p>
        {s.reveal ? (
          <div className="mt-3">
            <CardReveal card={s.reveal} label={s.firstEver ? "はじめてのカードを獲得！" : "カードを獲得！"} />
          </div>
        ) : s.card ? (
          <div className="mt-3 overflow-hidden rounded-2xl bg-card ring-1 ring-ink/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/cards/${s.card.id}/front.svg`} alt={`${s.card.designName} のカード`} className="aspect-[600/840] w-full" />
            <p className="p-2 text-center text-sm font-bold">
              カード「{s.card.designName}」を獲得！
            </p>
          </div>
        ) : (
          <p className="mt-3 text-center text-sm text-ink-soft">
            次のカード: <b>{s.nextCard.label}</b>
            <span className="block text-xs">{s.nextCard.hint}</span>
          </p>
        )}
        {s.nextMission && (
          <p className="mt-3 rounded-2xl bg-card px-3 py-2 text-center text-base ring-1 ring-ink/10">
            次のおすすめ: <b>{s.nextMission}</b>（10分）
          </p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href={`/cards${q}`} className="btn btn-white text-base">
            活動カード
          </Link>
          <button onClick={onClose} className="btn btn-ink text-base">
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
