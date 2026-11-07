"use client";

// はじめての人への「このアプリで何をするか」（11/7 本人の指摘「新規の登録者に分かりやすく。オープニングのあとにアニメーションで視覚的に」）。
// オープニング（WelcomeOpening）のあと、登録（RegisterChat）の前に、動く絵の5枚: お知らせ → 3チーム → 地図の家へ → 写真で完了 → ほかにできること。
// 画面をタップで次へ。放っておいても 4 秒ごとに進む。「とばす」でいつでも登録へ。
import { useEffect, useState } from "react";
import { TEAMS } from "@/lib/teams";
import { teamTheme } from "@/lib/team-theme";
import { play } from "@/lib/sound/engine";
import Icon from "./Icon";
import Mascot, { SnowTown } from "./Mascot";

const AUTO_MS = 4200;

/** 地図の絵（練習用。実在の場所ではない）: 道と家、待っている家のピン3つ、あなたの位置 */
function MapScene() {
  const houses: [number, number][] = [];
  for (const y of [22, 86, 150]) for (const x of [18, 70, 148, 200, 252]) houses.push([x, y]);
  const pins: [number, number][] = [[84, 36], [214, 100], [32, 164]];
  return (
    <svg viewBox="0 0 300 200" className="h-full w-full" aria-hidden="true">
      <rect width="300" height="200" fill="#eef3f7" rx="18" />
      <g stroke="#fff" strokeWidth="12" strokeLinecap="round">
        <path d="M-10 64 H310 M-10 128 H310 M120 -10 V210 M236 -10 V210" />
      </g>
      {houses.map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y + 10} width="30" height="22" rx="3" fill="#dbe5ee" />
          <path d={`M${x - 2} ${y + 12} L${x + 15} ${y} L${x + 32} ${y + 12}`} fill="#c9d8e4" />
          <rect x={x + 11} y={y + 17} width="8" height="7" rx="1" fill="#f3e2c8" />
        </g>
      ))}
      {/* あなた → 待っている家への道（点線） */}
      <path d="M150 172 C150 140 110 120 98 60" fill="none" stroke="#29445c" strokeWidth="3" strokeDasharray="6 7" className="tour-dash" />
      {pins.map(([x, y], i) => (
        <g key={i} className="tour-pin" style={{ animationDelay: `${0.4 + i * 0.35}s`, transformOrigin: `${x}px ${y + 24}px` }}>
          <circle cx={x} cy={y + 26} r="7" fill="rgba(217,130,91,0.25)" />
          <path d={`M${x} ${y} C${x - 10} ${y} ${x - 14} ${y + 7} ${x - 14} ${y + 13} C${x - 14} ${y + 22} ${x} ${y + 26} ${x} ${y + 26} S${x + 14} ${y + 22} ${x + 14} ${y + 13} C${x + 14} ${y + 7} ${x + 10} ${y} ${x} ${y} Z`} fill="#d9825b" />
          <circle cx={x} cy={y + 12} r="5" fill="#fff" />
        </g>
      ))}
      <g className="tour-pop" style={{ animationDelay: "0.2s" }}>
        <circle cx="150" cy="176" r="11" fill="#29445c" stroke="#fff" strokeWidth="3" />
        <text x="150" y="180" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">私</text>
      </g>
    </svg>
  );
}

/** 玄関の雪が減って道ができる絵（写真で完了） */
function YardScene() {
  return (
    <svg viewBox="0 0 300 180" className="h-full w-full" aria-hidden="true">
      <rect width="300" height="180" fill="#eaf3fa" rx="18" />
      <path d="M70 80 L150 22 L230 80 V160 H70 Z" fill="#f5eee5" stroke="#29445c" strokeWidth="3" strokeLinejoin="round" />
      <path d="M60 82 L150 14 L240 82" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" />
      <rect x="134" y="112" width="32" height="48" rx="3" fill="#3b6584" />
      <rect x="188" y="96" width="22" height="20" rx="2" fill="#f3c48a" className="opening-window" style={{ animationDelay: "2.2s" }} />
      <path d="M0 160 H300 V180 H0 Z" fill="#fff" />
      <path d="M134 160 L166 160 L190 180 H110 Z" fill="#c9d8e4" className="tour-fade-in" />
      <g className="tour-shrink" style={{ transformOrigin: "150px 168px" }}>
        <path d="M80 170 C92 118 128 104 150 108 C180 104 212 122 220 170 Z" fill="#fff" stroke="#c9d8e4" strokeWidth="3" />
        <path d="M112 132 C124 122 138 120 148 122" fill="none" stroke="#e3eef3" strokeWidth="5" strokeLinecap="round" />
      </g>
      {/* カメラの光 */}
      <rect width="300" height="180" rx="18" fill="#fff" className="tour-flash" />
    </svg>
  );
}

export default function AppTour({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const slides = [
    {
      key: "notice",
      title: "雪の朝、お知らせが届く",
      text: "10cm 以上積もった朝 6:30、隊長トークと通知で。毎朝の質問はありません。",
      scene: (
        <div className="relative grid h-full place-items-center">
          <Mascot size={150} mood="happy" className="captain-arrive drop-shadow-lg short:size-28" />
          <div className="tour-slide-in absolute inset-x-2 bottom-1 rounded-2xl bg-card px-3 py-2 text-left shadow-lg ring-1 ring-ink/10" style={{ animationDelay: "1.1s" }}>
            <p className="text-xs font-bold text-lamp-deep">❄ シマエナ隊長</p>
            <p className="text-base font-bold leading-snug">12cm 積もりました！<br />助けてほしい家が <b className="text-lamp-deep">3軒</b></p>
          </div>
        </div>
      ),
    },
    {
      key: "teams",
      title: "町内ランダム3チーム",
      text: "月曜〜日曜の1週間。日曜の夜に組み直すので、毎週ちがう顔ぶれ。",
      scene: (
        <ul className="grid h-full grid-cols-3 items-center gap-1">
          {TEAMS.map((t, k) => {
            const th = teamTheme(t.id);
            return (
              <li key={t.id} className="team-reveal text-center" style={{ animationDelay: `${0.2 + k * 0.3}s` }}>
                <Mascot team={t.id} size={92} className="mx-auto drop-shadow-md short:size-16" />
                <p className="mt-1 whitespace-nowrap rounded-full px-2 py-0.5 text-sm font-bold text-white max-[380px]:text-xs" style={{ background: t.color, color: th.onColor }}>
                  {t.name}
                </p>
              </li>
            );
          })}
        </ul>
      ),
    },
    {
      key: "map",
      title: "地図の家へ、10分だけ",
      text: "6〜19時なら、いつでも。2人以上で、無理せず。",
      scene: (
        <div className="relative h-full">
          <MapScene />
          <span className="tour-pop absolute bottom-2 right-2 rounded-full bg-lamp px-4 py-1.5 text-base font-black text-white shadow-md ready-pulse" style={{ animationDelay: "1.4s" }}>
            ▶ 雪かきGO！
          </span>
        </div>
      ),
    },
    {
      key: "photo",
      title: "終わったら写真で完了",
      text: "地図の家がチームの色に。カードと羽（あなたの点）が届きます。",
      scene: (
        <div className="relative h-full">
          <YardScene />
          <div className="tour-card-up absolute bottom-2 right-3 w-[42%] rotate-[-4deg] rounded-xl bg-card p-2 text-center shadow-lg ring-2 ring-camellia">
            <p className="text-xs font-bold text-camellia-deep">MISSION CLEAR</p>
            <p className="text-2xl font-black text-lamp-deep">+10点</p>
            <p className="text-xs font-bold">カード 1枚・羽 10</p>
          </div>
        </div>
      ),
    },
    {
      key: "more",
      title: "ほかにも、できること",
      text: "全部、ホームの下のタブから。",
      scene: (
        <ul className="grid h-full grid-cols-2 content-center gap-2">
          {(
            [
              ["chat", "隊長トーク", "何でも相談・お知らせ"],
              ["go", "ソロ活動", "自宅の雪かき・道の報告"],
              ["connect", "つなぐ", "友だちを誘う・バトン"],
              ["card", "きろく", "羽と、その時だけのカード"],
            ] as const
          ).map(([icon, label, sub], k) => (
            <li key={label} className="opening-pillar flex items-center gap-2 rounded-2xl bg-card px-2.5 py-2 shadow-md ring-1 ring-ink/10" style={{ animationDelay: `${0.15 + k * 0.2}s` }}>
              <Icon name={icon} size={34} accent="var(--lamp)" className="shrink-0" />
              <span className="min-w-0 leading-tight">
                <b className="block text-base">{label}</b>
                <span className="block text-xs text-ink-soft">{sub}</span>
              </span>
            </li>
          ))}
        </ul>
      ),
    },
  ];
  const last = slides.length - 1;
  const go = (n: number) => {
    const next = Math.max(0, Math.min(last, n));
    if (next === i) return;
    play(next > i ? "chirp" : "back");
    setI(next);
  };
  // 放っておいても次へ（最後の1枚では止まる）
  useEffect(() => {
    if (i >= last) return;
    const t = window.setTimeout(() => go(i + 1), AUTO_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  const s = slides[i];

  return (
    <div className="fixed inset-0 z-50 mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-paper text-ink" aria-label="このアプリでできること" data-sound="none">
      <SnowTown className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] w-full opacity-60" />
      <header className="relative flex shrink-0 items-center justify-between px-4 pt-[max(12px,env(safe-area-inset-top))]">
        <p className="text-sm font-bold">
          シマエナ<span className="text-lamp-deep">GO</span> って？
        </p>
        <button type="button" onClick={onDone} className="min-h-11 rounded-full px-3 text-sm font-bold underline">
          とばす ›
        </button>
      </header>
      {/* 絵（タップで次へ） */}
      {/* 絵は画面の高さの 6 割まで。上下のまん中に置いて、題名が絵のすぐ下に来るように */}
      <button type="button" onClick={() => (i < last ? go(i + 1) : undefined)} aria-label={i < last ? "次へ" : undefined} className="relative mx-4 my-auto h-[46dvh] max-h-[420px] min-h-0 w-auto shrink cursor-pointer rounded-3xl text-left short:h-[42dvh]">
        <div key={s.key} className="tour-fade h-full">{s.scene}</div>
      </button>
      <div key={`t-${s.key}`} className="relative shrink-0 px-5 pt-2 text-center">
        <p className="text-xs font-bold text-ink-soft">
          {i + 1} / {slides.length}
        </p>
        <h2 className="opening-rise text-2xl font-black leading-tight max-[380px]:text-xl">{s.title}</h2>
        <p className="opening-rise mt-1 text-base leading-snug short:text-sm" style={{ animationDelay: "0.15s" }}>
          {s.text}
        </p>
      </div>
      <div className="relative flex shrink-0 items-center justify-center gap-2 py-2" role="tablist" aria-label="ページ">
        {slides.map((x, k) => (
          <button key={x.key} type="button" role="tab" aria-selected={k === i} aria-label={`${k + 1}. ${x.title}`} onClick={() => go(k)} className={`h-2.5 rounded-full transition-all ${k === i ? "w-7 bg-ink" : "w-2.5 bg-ink/25"}`} />
        ))}
      </div>
      <div className="relative grid shrink-0 grid-cols-[auto_1fr] gap-2 px-4 pb-[max(14px,env(safe-area-inset-bottom))]">
        <button type="button" onClick={() => go(i - 1)} disabled={i === 0} className="btn btn-white min-h-14 px-4 text-base disabled:opacity-30">
          ‹
        </button>
        {i < last ? (
          <button type="button" onClick={() => go(i + 1)} className="btn btn-ink min-h-14 text-lg">
            次へ ›
          </button>
        ) : (
          <button type="button" onClick={onDone} data-sound="go" className="btn btn-lamp min-h-14 text-xl ready-pulse">
            隊員登録へ（30秒）›
          </button>
        )}
      </div>
    </div>
  );
}
