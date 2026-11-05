"use client";

// 使い方 = 触って覚えるチュートリアル（1画面1項目のスライド）。
// スマホは左右にスワイプ、PC は「次へ」「戻る」ボタンと ← → キー。LINE の操作は練習版（何も送信しない）。
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { inviteMessage, lineShareUrl } from "@/lib/share-links";
import { TEAMS } from "@/lib/teams";
import Mascot, { SnowTown } from "../Mascot";
import LineChat, { type ChatMsg } from "./LineChat";

const STEPS = ["はじめに", "参加する", "雪かきに行く", "雪かきをする", "完了する", "仲間になる"] as const;
const LAST = STEPS.length - 1;
/** 点呼の答え（本物の LINE と同じ。spec v1.8: いつ手伝えそうか） */
const WHEN = [
  ["am", "朝（〜9時）"],
  ["noon", "お昼（〜13時）"],
  ["pm", "夕方（〜19時）"],
] as const;
const SNOW = 5; // 雪の山（ひとすくい × 5）

/* ---------- 小さな絵 ---------- */

function Shovel({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 90" className={className} aria-hidden="true">
      <path d="M20 4 V58" stroke="#7a5a44" strokeWidth="5" strokeLinecap="round" />
      <path d="M12 4 H28" stroke="#29445c" strokeWidth="5" strokeLinecap="round" />
      <path d="M6 58 H34 L30 86 H10 Z" fill="#d9825b" stroke="#29445c" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}

/** 雪かきの場面: 家と雪の山（left が減ると山が小さくなる） */
function YardScene({ left }: { left: number }) {
  const s = left / SNOW;
  return (
    <svg viewBox="0 0 300 170" preserveAspectRatio="xMidYMax meet" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <path d="M150 70 L210 22 L270 70 V150 H150 Z" fill="#f5eee5" stroke="#29445c" strokeWidth="3" strokeLinejoin="round" />
      <path d="M142 72 L210 16 L278 72" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" />
      <rect x="196" y="104" width="26" height="46" rx="3" fill="#3b6584" />
      <rect x="236" y="88" width="20" height="18" rx="2" fill="#f3c48a" />
      <path d="M0 150 H300 V170 H0 Z" fill="#fff" />
      {/* 玄関から道路への道（雪が減ると見えてくる） */}
      <path d="M196 150 L222 150 L240 170 L178 170 Z" fill="#c9d8e4" opacity={1 - s} />
      {/* 雪の山 */}
      <g style={{ transform: `scale(${0.25 + 0.75 * s})`, transformOrigin: "200px 160px", transition: "transform .3s ease" }}>
        <path d="M130 162 C140 112 175 100 200 104 C232 100 262 118 270 162 Z" fill="#fff" stroke="#c9d8e4" strokeWidth="3" />
        <path d="M160 128 C172 118 186 116 196 118" fill="none" stroke="#e3eef3" strokeWidth="5" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** 町の地図（練習用の絵。実在の場所ではない）。縦長の画面に合わせて家を小さく並べる */
function MiniMap() {
  const houses: [number, number][] = [];
  for (const y of [14, 74, 154, 214, 294]) for (const x of [14, 52, 128, 166, 242]) houses.push([x, y]);
  return (
    <svg viewBox="0 0 300 360" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <rect width="300" height="360" fill="#eef3f7" />
      <g stroke="#fff" strokeWidth="12" strokeLinecap="round">
        <path d="M-10 128 H310 M-10 268 H310 M108 -10 V370 M222 -10 V370" />
        <path d="M-10 58 H96 M120 200 H210 M234 340 H310" strokeWidth="6" />
      </g>
      <path d="M-10 345 C80 330 170 356 310 334" stroke="#bcd3e2" strokeWidth="10" fill="none" />
      {[[20, 300], [280, 100], [190, 250]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y - 18} L${x + 9} ${y} H${x - 9} Z`} fill="#c9d8e4" />
      ))}
      {houses.map(([x, y], i) => (
        <g key={i}>
          <rect x={x} y={y + 8} width="28" height="22" rx="3" fill="#dbe5ee" />
          <path d={`M${x - 2} ${y + 10} L${x + 14} ${y - 2} L${x + 30} ${y + 10}`} fill="#c9d8e4" />
          <rect x={x + 10} y={y + 15} width="8" height="7" rx="1" fill="#f3e2c8" />
        </g>
      ))}
    </svg>
  );
}

/* ---------- 部品 ---------- */

function Title({ children, sub, as: Tag = "h2", id }: { children: React.ReactNode; sub?: React.ReactNode; as?: "h1" | "h2"; id: string }) {
  return (
    <div className="shrink-0 text-center">
      <Tag id={id} tabIndex={-1} className="text-xl font-bold leading-snug outline-none short:text-lg">
        {children}
      </Tag>
      {sub && <p className="mt-0.5 text-base leading-snug text-ink-soft short:text-sm">{sub}</p>}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex shrink-0 items-center gap-2 rounded-2xl bg-ice-soft px-3 py-2 text-base leading-snug short:py-1.5">
      <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" className="shrink-0">
        <path d="M12 3 A6 6 0 0 0 8 13.5 V16 H16 V13.5 A6 6 0 0 0 12 3 Z" fill="#f3c48a" stroke="#29445c" strokeWidth="1.6" />
        <path d="M9.5 19 H14.5 M10.5 21.5 H13.5" stroke="#29445c" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      <span>{children}</span>
    </p>
  );
}

const CONFETTI = ["#d9825b", "#8fb8c9", "#c8a7b8", "#29445c", "#f3c48a", "#d9825b", "#8fb8c9", "#c8a7b8", "#f3c48a", "#29445c"];

/* ---------- 本体 ---------- */

export default function Tutorial({ joinUrl, rules }: { joinUrl?: string; rules: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [rulesOpen, setRulesOpen] = useState(false);
  // 練習の進み具合
  const [when, setWhen] = useState<string | null>(null);
  const [picked, setPicked] = useState(false);
  const [going, setGoing] = useState(false);
  const [snow, setSnow] = useState(SNOW);
  const [digKey, setDigKey] = useState(0);
  const [safety, setSafety] = useState<boolean[]>([false, false, false]);
  const [photo, setPhoto] = useState(false);
  const [flash, setFlash] = useState(0);
  const [showJoinHelp, setShowJoinHelp] = useState(false);

  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; horiz?: boolean } | null>(null);
  const dragged = useRef(false);
  const moved = useRef(false);

  const go = useCallback((n: number) => {
    moved.current = true;
    setIndex(Math.max(0, Math.min(LAST, n)));
  }, []);

  // ページが変わったら、その見出しへ読み上げの位置を移す（画面は動かさない）
  useEffect(() => {
    if (!moved.current) return;
    document.getElementById(`tut-h-${index}`)?.focus({ preventScroll: true });
  }, [index]);

  // PC: ← → キーでも進める
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (rulesOpen) {
        if (e.key === "Escape") setRulesOpen(false);
        return;
      }
      if (e.key === "ArrowRight") go(index + 1);
      if (e.key === "ArrowLeft") go(index - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, go, rulesOpen]);

  // スマホ: 左右のスワイプ（縦の動きはそのまま）
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY };
    dragged.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (d.horiz === undefined && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) d.horiz = Math.abs(dx) > Math.abs(dy);
    if (!d.horiz) return;
    dragged.current = true;
    const edge = (index === 0 && dx > 0) || (index === LAST && dx < 0);
    setDragX(edge ? dx / 3 : dx);
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.horiz) return setDragX(0);
    const dx = e.clientX - d.x;
    const w = viewport.current?.clientWidth ?? 360;
    if (Math.abs(dx) > Math.min(80, w * 0.18)) go(index + (dx < 0 ? 1 : -1));
    setDragX(0);
  };
  // スワイプのあとに指を離した場所のボタンが押されないように
  const onClickCapture = (e: React.MouseEvent) => {
    if (dragged.current) {
      e.preventDefault();
      e.stopPropagation();
      dragged.current = false;
    }
  };

  const team = TEAMS[0];
  const practiced = [when !== null, going, snow === 0, photo];

  /* --- LINE の会話（押したボタンから組み立てる） --- */
  const rollcall: ChatMsg[] = [
    { id: "h1", from: "bot", text: "おはようだしま〜！☃️\n今朝は雪12cm、相手は『ぼた雪のドンブリ』です。" },
    { id: "h2", from: "bot", text: "今日、いつ手伝えそうですか？\n（6時〜19時なら、いつでも10分から）" },
  ];
  if (when !== null) {
    rollcall.push({ id: "a", from: "me", text: when === "0" ? "今日は休む" : (WHEN.find(([k]) => k === when)?.[1] ?? "") });
    rollcall.push({
      id: "r",
      from: "bot",
      text:
        when === "0"
          ? "わかりました。今日はゆっくり休んでください。\nまたの雪の日に、よろしくしま〜！"
          : when === "noon"
            ? "ありがとうしま〜！\n11:30 ごろ、まだ待っている家をお知らせします。"
            : when === "pm"
              ? "ありがとうしま〜！\n16:30 ごろ、まだ待っている家をお知らせします。"
              : "ありがとうしま〜！\n6:40 に、行き先をお知らせします。",
    });
  }
  const report: ChatMsg[] = [
    { id: "g", from: "bot", text: "了解だしま〜！🙌\n拠点3へ 7:00 に集合です！" },
    { id: "p", from: "bot", text: "終わったら、玄関の前から道路の方を写した写真を1枚送ってください。" },
  ];
  if (photo) {
    report.push({ id: "ph", from: "me", photo: true });
    report.push({ id: "d1", from: "bot", text: "拠点3 完了だしま〜！🎉\nあなたの10分で、1軒が助かりました。" });
    report.push({ id: "d2", from: "bot", text: `${team.name}に +15 点。\nありがとうカードは後で届きます。` });
  }
  const takePhoto = () => {
    setFlash((f) => f + 1);
    setPhoto(true);
  };

  const slides: React.ReactNode[] = [
    /* 0 はじめに */
    <>
      <div className="snowfield relative min-h-0 flex-1 overflow-hidden rounded-3xl ring-1 ring-ink/10">
        <div className="relative z-10 pt-4 text-center short:pt-2">
          <h1 id="tut-h-0" tabIndex={-1} className="text-5xl font-bold leading-none outline-none short:text-4xl">
            シマエナ<span className="text-lamp-deep">GO</span>
          </h1>
          <p className="mt-2 text-lg font-bold leading-snug short:mt-1 short:text-base">
            10分の雪かきで、
            <br />
            町が変わる。
          </p>
        </div>
        <SnowTown className="absolute inset-x-0 bottom-0 h-1/3 w-full" />
        <div className="tut-bob absolute bottom-[8%] left-1/2 h-[52%] -translate-x-1/2">
          <Mascot className="h-full w-auto drop-shadow-md" />
          <Shovel className="absolute -right-[22%] bottom-[2%] h-[78%] w-auto rotate-12" />
        </div>
      </div>
      <div className="shrink-0 rounded-3xl bg-card px-4 py-3 text-center shadow-sm ring-1 ring-ink/10 short:py-2">
        <p className="text-lg font-bold">寒い冬は、くっついて乗り切る。</p>
        <p className="text-base leading-snug">町内のみんなで、ひとり暮らしの家の雪かきを助け合うゲームです。</p>
      </div>
      <button type="button" onClick={() => go(1)} className="btn btn-lamp btn-big shrink-0 rounded-full">
        さあ、はじめましょう！ ›
      </button>
      <button type="button" onClick={() => setRulesOpen(true)} className="shrink-0 text-base font-bold underline">
        くわしいルールだけ見る
      </button>
    </>,

    /* 1 参加する: 点呼に答える */
    <>
      <Title id="tut-h-1" sub="雪の朝 6:30、LINE にこの1問が届きます。下のボタンを押してみよう。">
        今日、いつ手伝えそうですか？
      </Title>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <LineChat
          className="flex-1"
          messages={rollcall}
          replies={
            when === null
              ? [...WHEN.map(([k, label]) => ({ label, onClick: () => setWhen(k) })), { label: "今日は休む", onClick: () => setWhen("0") }]
              : [{ label: "↺ 選び直す", onClick: () => setWhen(null) }]
          }
        />
      </div>
      <Hint>
        <b>10分だけでも大歓迎！</b> 朝に間に合わなくても、19時まで自分の時間で。体調がすぐれない日は「今日は休む」で大丈夫です。
      </Hint>
    </>,

    /* 2 雪かきに行く: 地図で家を選んで「行く」 */
    <>
      <Title id="tut-h-2" sub="6:40、行き先が届きます。地図のオレンジのピンを押してみよう。">
        近くの雪かきを見つけよう！
      </Title>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl ring-1 ring-ink/15">
        <MiniMap />
        {/* 自分の家 */}
        <span className="me-pin absolute left-[18%] top-[62%] px-2">あなた</span>
        {/* 助けが必要な家 */}
        <button
          type="button"
          onClick={() => setPicked(true)}
          aria-pressed={picked}
          aria-label="拠点3（雪かきが必要な家）を選ぶ"
          className="absolute left-[58%] top-[30%] grid -translate-x-1/2 place-items-center"
        >
          {!picked && <span className="absolute size-14 animate-ping rounded-full bg-lamp/40 motion-reduce:hidden" />}
          <svg viewBox="0 0 24 30" width="44" height="54" aria-hidden="true" className="relative drop-shadow-md">
            <path d="M12 1 C5.4 1 1.5 5.9 1.5 11.3 C1.5 19 12 29 12 29 S22.5 19 22.5 11.3 C22.5 5.9 18.6 1 12 1 Z" fill="var(--lamp)" stroke="#fff" strokeWidth="1.5" />
            <path d="M7 12 L12 7.5 L17 12 V17 H7 Z" fill="#fff" />
          </svg>
        </button>
        {picked && !going && (
          <p className="tut-pop absolute left-[58%] top-[6%] -translate-x-1/2 whitespace-nowrap rounded-2xl bg-card px-3 py-1 text-sm font-bold shadow-md">
            このお家の雪かきを手伝おう！
          </p>
        )}
        {/* 下のカード: 押したら出る */}
        <div className="absolute inset-x-2 bottom-2">
          {!picked ? (
            <p className="rounded-2xl bg-card/95 px-3 py-2 text-center text-base font-bold shadow-md">👆 オレンジのピンを押してみよう</p>
          ) : !going ? (
            <div className="tut-pop space-y-2 rounded-2xl bg-card p-3 shadow-md">
              <p className="leading-tight">
                <b className="text-xl">拠点3</b>
                <span className="ml-2 text-base font-bold text-alert">あと1人</span>
                <span className="block text-base">雪かきが必要です ・ 7:00 開始</span>
              </p>
              <div className="grid grid-cols-[1.4fr_1fr] gap-2">
                <button type="button" onClick={() => setGoing(true)} className="btn btn-lamp">
                  行く
                </button>
                <button type="button" onClick={() => setPicked(false)} className="btn btn-white text-base">
                  今朝は行けない
                </button>
              </div>
            </div>
          ) : (
            <div className="tut-pop flex items-end gap-2 rounded-2xl bg-card p-3 shadow-md">
              <Mascot size={44} mood="happy" className="shrink-0" />
              <p className="text-base leading-snug">
                <b>了解だしま〜！🙌</b>
                <br />
                拠点3へお願いします。7:00 開始です。
              </p>
            </div>
          )}
        </div>
      </div>
      <Link href="/map" className="btn btn-white shrink-0 gap-2 rounded-full text-base">
        📍 本物の「町の地図」を開く
      </Link>
    </>,

    /* 3 雪かきをする: 雪の山を押す・安全のチェック */
    <>
      <Title id="tut-h-3" sub="無理のない範囲で。雪の山を押して、ひとすくい！">
        雪かきをはじめましょう！
      </Title>
      <button
        type="button"
        disabled={snow === 0}
        onClick={() => {
          setSnow((s) => Math.max(0, s - 1));
          setDigKey((k) => k + 1);
        }}
        aria-label={snow > 0 ? `ひとすくい（のこり ${snow}）` : "雪かき完了"}
        className="snowfield relative min-h-0 flex-1 overflow-hidden rounded-3xl ring-1 ring-ink/10 active:scale-[0.99]"
      >
        <YardScene left={snow} />
        <span key={digKey} className="tut-dig absolute bottom-[4%] left-[6%] h-[58%]">
          <Mascot mood={snow === 0 ? "happy" : "normal"} className="h-full w-auto drop-shadow-md" />
          <Shovel className="absolute -right-[18%] bottom-0 h-[70%] w-auto -rotate-[28deg]" />
        </span>
        <span className="absolute inset-x-3 top-3 flex items-center gap-2">
          <span className="h-3 flex-1 overflow-hidden rounded-full bg-white ring-1 ring-ink/10">
            <span className="block h-full rounded-full bg-ice transition-[width] duration-300" style={{ width: `${(snow / SNOW) * 100}%` }} />
          </span>
          <b className="rounded-full bg-card px-2 text-sm tabular-nums">{snow > 0 ? `のこり ${snow}` : "道ができた！✨"}</b>
        </span>
      </button>
      <div className="shrink-0 rounded-2xl bg-ice-soft px-3 py-2 short:py-1.5" role="group" aria-label="安全に気をつけて">
        <p className="text-base font-bold">🛡 安全に気をつけて（押してチェック）</p>
        <ul className="mt-1 grid grid-cols-3 gap-1.5">
          {["無理をしない", "屋根の下・車に注意", "あたたかい服装"].map((t, i) => (
            <li key={t}>
              <button
                type="button"
                aria-pressed={safety[i]}
                onClick={() => setSafety((s) => s.map((v, j) => (j === i ? !v : v)))}
                className={`flex min-h-12 w-full items-center justify-center rounded-xl px-1 text-sm font-bold leading-tight ring-2 ${safety[i] ? "bg-ink text-white ring-ink" : "bg-card ring-ink/20"}`}
              >
                {safety[i] ? "✓ " : ""}
                {t}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>,

    /* 4 完了する: LINE で写真を送る */
    <>
      <Title id="tut-h-4" sub="LINE の「写真を撮る」を押してみよう（練習なので撮影も送信もしません）。">
        終わったら、写真を1枚！
      </Title>
      <div className="relative flex min-h-0 flex-1 flex-col">
        <LineChat
          className="flex-1"
          messages={report}
          replies={
            photo
              ? [{ label: "↺ もう一度", onClick: () => setPhoto(false) }]
              : [
                  { label: "写真を撮る", icon: "camera", onClick: takePhoto },
                  { label: "写真を選ぶ", icon: "image", onClick: takePhoto },
                ]
          }
        />
        {flash > 0 && <span key={flash} className="tut-flash pointer-events-none absolute inset-0 rounded-3xl bg-white opacity-0" aria-hidden="true" />}
      </div>
      {photo ? (
        <Hint>
          町の地図のマスが<b>チームの色</b>に塗られて、その時だけの<b>カード</b>が届きます。
        </Hint>
      ) : (
        <button type="button" onClick={() => go(5)} className="min-h-11 shrink-0 text-base font-bold underline">
          スキップして次へ →
        </button>
      )}
    </>,

    /* 5 仲間になる: お祝い・ルール・LINE で参加 */
    <>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl bg-gradient-to-b from-ice-soft to-paper ring-1 ring-ink/10">
        {index === LAST && (
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {CONFETTI.map((c, i) => (
              <span key={i} className="confetti" style={{ left: `${6 + i * 9.5}%`, background: c, animationDelay: `${(i % 5) * 0.55}s` }} />
            ))}
          </div>
        )}
        <div className="relative px-3 pt-3 text-center short:pt-2">
          <h2 id="tut-h-5" tabIndex={-1} className="text-2xl font-bold leading-snug outline-none short:text-xl">
            これであなたも
            <br />
            シマエナ<span className="text-lamp-deep">GO</span>の仲間！
          </h2>
          <p className="text-base leading-snug text-ink-soft short:text-sm">みんなで助け合って、雪の朝を楽しく。</p>
        </div>
        <SnowTown className="absolute inset-x-0 bottom-0 h-1/4 w-full" />
        <div className="absolute inset-x-0 bottom-[6%] top-[44%] flex flex-col items-center">
          <Mascot mood="happy" className="tut-bob h-full min-h-0 w-auto drop-shadow-md" />
          <p className="-mt-6 rotate-[-3deg] rounded-xl bg-ink px-4 py-1 text-lg font-bold text-white shadow-md">一緒にがんばろう！</p>
        </div>
      </div>
      <ul className="flex shrink-0 justify-center gap-1.5 text-sm font-bold" aria-label="練習したこと">
        {["答える", "行く", "雪かき", "写真"].map((t, i) => (
          <li key={t} className={`rounded-full px-2.5 py-0.5 ring-1 ${practiced[i] ? "bg-ink text-white ring-ink" : "bg-card text-ink-soft ring-ink/20"}`}>
            {practiced[i] ? "✓ " : ""}
            {t}
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setRulesOpen(true)} className="btn btn-white shrink-0 justify-between rounded-2xl px-4 text-lg">
        <span>⭐ 大切なルール</span>
        <span aria-hidden="true">⌄</span>
      </button>
      {joinUrl ? (
        <a href={joinUrl} className="btn btn-big shrink-0 gap-2 rounded-full bg-[#06C755] text-white shadow-md">
          <span className="rounded-md bg-white px-1.5 text-sm font-bold text-[#06C755]">LINE</span>
          LINE で参加する
        </a>
      ) : (
        <button type="button" onClick={() => setShowJoinHelp((v) => !v)} className="btn btn-big shrink-0 gap-2 rounded-full bg-[#06C755] text-white shadow-md">
          <span className="rounded-md bg-white px-1.5 text-sm font-bold text-[#06C755]">LINE</span>
          LINE で参加する
        </button>
      )}
      {showJoinHelp && !joinUrl && <p className="tut-pop shrink-0 text-center text-base">LINE で「シマエナGO」を検索して友だち追加 → 登録（1分）</p>}
      <button
        type="button"
        onClick={() => {
          const m = inviteMessage(window.location.origin, joinUrl);
          window.open(lineShareUrl(m.text, m.url), "_blank", "noopener,noreferrer");
        }}
        className="min-h-10 shrink-0 text-base font-bold underline"
      >
        LINE で友だちも誘う →
      </button>
    </>,
  ];

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
      {/* ページ番号と進み具合 */}
      <div className="shrink-0 px-4 pt-3 short:pt-2">
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-ink px-3 py-0.5 text-base font-bold tabular-nums text-white" aria-live="polite">
            {index + 1} / {STEPS.length}
          </span>
          <span className="rounded-full bg-ice-soft px-3 py-0.5 text-sm font-bold">{STEPS[index]}</span>
        </div>
        <div className="mt-2 grid grid-cols-6 gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={index + 1} aria-label="チュートリアルの進み具合">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 rounded-full transition-colors ${i <= index ? "bg-lamp" : "bg-ink/15"}`} />
          ))}
        </div>
      </div>

      {/* スライド（左右にスワイプ） */}
      <div
        ref={viewport}
        className="relative min-h-0 flex-1 overflow-hidden"
        aria-roledescription="carousel"
        aria-label="使い方"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={onClickCapture}
      >
        <div className={`tut-track flex h-full ${dragX !== 0 ? "dragging" : ""}`} style={{ transform: `translateX(calc(${-index * 100}% + ${dragX}px))` }}>
          {slides.map((content, i) => (
            <section
              key={i}
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${STEPS.length} ${STEPS[i]}`}
              inert={i !== index}
              className="flex h-full w-full shrink-0 flex-col gap-3 px-4 pb-2 pt-3 short:gap-2 short:pt-2"
            >
              {content}
            </section>
          ))}
        </div>
      </div>

      {/* 戻る・点・次へ（PC はここで進める） */}
      <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center px-4 pb-2">
        <button type="button" onClick={() => go(index - 1)} className={`btn justify-self-start whitespace-nowrap px-1 text-base ${index === 0 ? "invisible" : ""}`}>
          ← 戻る
        </button>
        <div className="flex">
          {STEPS.map((s, i) => (
            <button key={s} type="button" onClick={() => go(i)} aria-label={`${i + 1}ページ目（${s}）へ`} aria-current={i === index ? "step" : undefined} className="grid h-9 w-5 place-items-center">
              <span className={`block rounded-full transition-all ${i === index ? "h-2.5 w-4 bg-lamp" : "size-2 bg-ink/20"}`} />
            </button>
          ))}
        </div>
        {index < LAST ? (
          <button type="button" onClick={() => go(index + 1)} className="btn btn-ink min-h-12 justify-self-end whitespace-nowrap rounded-full px-5 text-base">
            次へ →
          </button>
        ) : (
          <button type="button" onClick={() => go(0)} className="btn btn-white min-h-12 justify-self-end whitespace-nowrap rounded-full px-3 text-base">
            ↺ 最初から
          </button>
        )}
      </div>

      {/* くわしいルール（下から出るシート。中は開け閉めできる項目） */}
      {rulesOpen && (
        <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-ink/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="くわしいルール" onClick={() => setRulesOpen(false)}>
          <div className="tut-pop flex max-h-[88dvh] w-full max-w-md flex-col rounded-t-3xl bg-paper text-ink shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-ink/10 px-4 py-2">
              <h2 className="text-xl font-bold">⭐ くわしいルール</h2>
              <button type="button" autoFocus onClick={() => setRulesOpen(false)} className="btn btn-white min-h-11 px-4 text-base">
                閉じる
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto px-4 py-3 pb-[max(16px,env(safe-area-inset-bottom))]">{rules}</div>
          </div>
        </div>
      )}
    </div>
  );
}
