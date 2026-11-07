"use client";

// ソロ出動の完了演出（spec v1.3）。羽が舞い、入った羽・連続出動・カード・ひとことを見せる。
// 11/5 本人の指示「基本1画面」: 縦にスクロールさせず、けっか／カード／隊長／つなぐ（知らせる・バトン・次は？）のタブに分ける。
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import type { SoloClearSummary } from "@/lib/solo/ops";
import Mascot, { SnowTown } from "./Mascot";
import CardReveal from "./CardReveal";
import InviteDrafts from "./InviteDrafts";
import ClearFrame, { ConnectPanel, FIT_CARD, FIT_IMG, Panel } from "./ClearFrame";
import type { PagerTab } from "./Pager";
import { play } from "@/lib/sound/engine";

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
    let lastTick = 0;
    let popped = false;
    const t0 = performance.now() + delay;
    const tick = (t: number) => {
      const k = reduce ? 1 : Math.min(1, Math.max(0, (t - t0) / ms));
      setN(Math.round(to * (1 - (1 - k) ** 3)));
      // 音: 数えている間は 90ms ごとに「カッ」、数え終わりに「ポン」
      if (k > 0 && k < 1 && t - lastTick > 90) {
        lastTick = t;
        play("countTick", { gain: 0.6 + k * 0.6 });
      }
      if (k >= 1 && !popped && to > 0) {
        popped = true;
        play("countPop");
      }
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

export default function SoloClear({
  summary,
  onClose,
  q,
  minutesLabel,
  share = [],
  baton,
}: {
  summary: SoloClearSummary;
  onClose: () => void;
  q: string;
  minutesLabel?: string;
  /** 「つなぐ」タブの「知らせる」に1つずつ出すもの（地図のピン・自慢の画像・SNS・投稿文）。null は飛ばす */
  share?: (ReactNode | null | false | undefined)[];
  /** 「つなぐ」タブの「バトン」「次は？」（view でどちらを出すか） */
  baton?: (view: "baton" | "wish") => ReactNode;
}) {
  const s = summary;
  const bonus = s.bonuses.reduce((a, b) => a + b.feathers, 0);
  // 音: 家に灯り（ファンファーレは直前の「クリア！」の全画面で鳴っている）
  useEffect(() => {
    play("lamp", { delay: 0.2 });
  }, []);
  const shareItems = share.filter((x): x is ReactNode => Boolean(x));
  const hasShare = shareItems.length > 0 || Boolean(s.invites && s.invites.length > 0);
  const tabs: PagerTab[] = [
    { key: "result", label: "けっか" },
    { key: "card", label: "カード" },
    { key: "captain", label: "隊長" },
    ...(hasShare || baton ? [{ key: "connect", label: "つなぐ" }] : []),
  ];
  const [tab, setTab] = useState(0);
  const [go, setGo] = useState<number | undefined>(undefined);
  const open = (key: string) => {
    const i = tabs.findIndex((t) => t.key === key);
    if (i >= 0) setGo(i);
  };
  const invite = s.invites && s.invites.length > 0 ? <InviteDrafts drafts={s.invites} url={s.inviteUrl} result={s.inviteResult} /> : undefined;

  return (
    <ClearFrame
      label="ソロ出動 完了"
      decor={
        <div className="feathers pointer-events-none absolute inset-0" aria-hidden="true">
          {FEATHERS.map((f, i) => (
            <span key={i} className="feather" style={{ left: `${f.left}%`, animationDelay: `${f.delay}s` }}>
              <Feather color={f.color} />
            </span>
          ))}
        </div>
      }
      hero={
        <div className="relative mb-2 overflow-hidden bg-gradient-to-b from-ice-soft to-paper px-4 pb-7 pt-3 [@media(max-height:700px)]:mb-1 [@media(max-height:700px)]:pb-6 [@media(max-height:700px)]:pt-1.5">
          <p className="eyebrow">ソロ出動 完了・{s.label}</p>
          <div className="flex items-center gap-2">
            <Mascot size={72} mood="happy" className="lamp-glow shrink-0" />
            <h2 className="whitespace-nowrap text-lg font-bold leading-snug">
              あなたの<span className="text-2xl text-lamp-deep">{minutesLabel ?? (s.onsite ? "10分" : "3分")}</span>が、
              <br />
              町の力になりました！
            </h2>
          </div>
          <SnowTown className="absolute inset-x-0 bottom-0 h-7 w-full [@media(max-height:700px)]:h-5" />
        </div>
      }
      heroOn={tab === 0}
      tabs={tabs}
      index={go}
      onTab={(i) => {
        setTab(i);
        setGo(undefined);
      }}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/cards${q}`} className="btn btn-white text-base">
            活動カード
          </Link>
          <button onClick={onClose} className="btn btn-ink text-base">
            閉じる
          </button>
        </div>
      }
    >
      {/* けっか: 入った羽・点・どけた雪・今日の数字 */}
      <Panel center>
        <p className="text-center">
          <span className="text-5xl font-bold text-camellia-deep">+<CountUp to={s.feathers} /></span>
          <span className="text-xl font-bold"> 羽</span>
          {bonus > 0 && <span className="ml-2 rounded-full bg-camellia-soft px-2 py-0.5 text-sm font-bold text-camellia-deep ring-1 ring-camellia">ごほうび +{bonus}</span>}
        </p>
        {s.teamPoints > 0 && (
          <p className="pop-late text-center text-lg font-bold">
            {s.teamName ?? "チーム"} に <span className="text-2xl text-lamp-deep">+{s.teamPoints}点</span>
          </p>
        )}
        {s.snowKg !== undefined && s.snowKg > 0 && (
          <div className="pop-late rounded-2xl bg-ice-soft px-3 py-1.5 text-center ring-1 ring-ice">
            <p className="text-base font-bold">
              どけた雪 およそ <span className="text-3xl tabular-nums">{s.snowKg}</span>kg
            </p>
            <p className="text-base font-bold">{s.snowKgComparison}</p>
            {s.snowKgBasis && <p className="text-xs text-ink-soft">推定: {s.snowKgBasis}</p>}
          </div>
        )}
        {s.strokes !== undefined && s.strokes > 0 && (
          // v1.31 スコップカウンター（スマホのセンサーで数えた回数。得点には入れない）
          <p className="pop-late text-center text-base font-bold">
            ⛏ スコップ <span className="text-2xl tabular-nums">{s.strokes}</span>回
            <span className="block text-xs font-normal text-ink-soft">スマホのセンサーで数えた「ザクッ」の回数</span>
          </p>
        )}
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-2xl bg-card px-2 py-1.5 ring-1 ring-ink/10">
            <p className="font-bold">今日</p>
            <p className="text-xl font-bold tabular-nums">{s.todayFeathers}羽</p>
          </div>
          <div className="rounded-2xl bg-card px-2 py-1.5 ring-1 ring-ink/10">
            <p className="font-bold">連続</p>
            <p className="text-xl font-bold tabular-nums">{s.streak}日</p>
          </div>
          <div className="rounded-2xl bg-card px-2 py-1.5 ring-1 ring-ink/10">
            <p className="font-bold">合計</p>
            <p className="text-xl font-bold tabular-nums">{s.totalFeathers}羽</p>
          </div>
        </div>
        {s.teamCapped && <p className="text-center text-sm text-ink-soft">今日のソロのチーム得点は上限（15点）に届きました。羽はこのあともたまります。</p>}
        {!s.onsite && s.teamPoints === 0 && <p className="text-center text-sm text-ink-soft">アプリでの参加のチーム得点は、1日3点までです。</p>}
        <button onClick={() => open("card")} className="btn btn-lamp w-full text-lg">
          {s.card ? "🎴 カードを見る ›" : "🎴 次のカードを見る ›"}
        </button>
      </Panel>

      {/* カード: 発行の演出（タブを開いたときに動かす） */}
      <Panel center>
        {s.reveal ? (
          <div className={FIT_CARD}>{tab === 1 && <CardReveal card={s.reveal} label={s.firstEver ? "はじめてのカードを獲得！" : "カードを獲得！"} />}</div>
        ) : s.card ? (
          <div className={`overflow-hidden rounded-2xl bg-card ring-1 ring-ink/10 ${FIT_IMG}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/cards/${s.card.id}/front.svg`} alt={`${s.card.designName} のカード`} className="aspect-[600/840]" />
            <p className="p-2 text-center text-sm font-bold">カード「{s.card.designName}」を獲得！</p>
          </div>
        ) : (
          <p className="rounded-2xl bg-card px-3 py-4 text-center text-lg ring-1 ring-ink/10">
            次のカード: <b>{s.nextCard.label}</b>
            <span className="block text-base text-ink-soft">{s.nextCard.hint}</span>
          </p>
        )}
      </Panel>

      {/* 隊長から: ひとこと・初出撃・写真の確認・ごほうび・次のおすすめ */}
      <Panel center>
        {s.firstEver && (
          <p className="rounded-2xl bg-camellia-soft px-3 py-2 text-center text-base font-bold ring-1 ring-camellia">
            初出撃おめでとう！今日からあなたも、しらかば町内の群れの一員です。
          </p>
        )}
        <p className="rounded-2xl bg-warm px-3 py-2 text-center text-lg">
          <span className="eyebrow block">シマエナ隊長から</span>
          {s.hitokoto}
        </p>
        {s.bonuses.length > 0 && (
          <ul className="text-center text-sm text-ink-soft">
            {s.bonuses.map((b) => (
              <li key={b.label}>
                ★ {b.label} +{b.feathers}羽
              </li>
            ))}
          </ul>
        )}
        {s.photoNote && <p className="rounded-2xl bg-card px-3 py-2 text-sm ring-1 ring-ink/10">{s.photoNote}</p>}
        {!s.onsite && <p className="text-center text-xs text-ink-soft">オンラインの確認は雪かき完了にはなりません。次は10分、外へ。</p>}
        {s.nextMission && (
          <p className="rounded-2xl bg-card px-3 py-2 text-center text-base ring-1 ring-ink/10">
            次のおすすめ: <b>{s.nextMission}</b>（10分）
          </p>
        )}
      </Panel>

      {/* つなぐ: 共有（地図のピン → 自慢の画像 → SNS → 投稿文）／誘う／バトン／次は？ */}
      {(hasShare || baton) && (
        <Panel>
          <ConnectPanel shares={shareItems} invite={invite} baton={baton} more={`/connect${q}`} />
        </Panel>
      )}
    </ClearFrame>
  );
}
