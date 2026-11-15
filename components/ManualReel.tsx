"use client";

// ログイン画面の「動くマニュアル」（spec v1.62。本人の指示「ログインのトップ画面にマニュアルを。スムーズな動画でリズムよく」）。
// 4コマ（お知らせ → 3チーム → 地図の家へ → 写真で完了）が、BGM「しらかばの朝」（82bpm）の4拍ごとに切りかわって、くり返す。
// 絵の中の動きも1拍ごと（--beat）。タップで次のコマへ。音ファイル・動画ファイルは使わない（絵と CSS だけ）。
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { TEAMS } from "@/lib/teams";
import Mascot from "./Mascot";

const BEAT_MS = 60000 / 82; // 1拍
const SCENE_MS = BEAT_MS * 4; // 1コマ = 4拍（約2.9秒）

/** n 拍目に出す */
const at = (n: number): CSSProperties => ({ animationDelay: `calc(var(--beat) * ${n})` });

function Notice() {
  return (
    <div className="relative h-full">
      <span className="reel-pop absolute bottom-0 left-0 block aspect-square w-[68%]">
        <Mascot mood="happy" className="size-full" />
      </span>
      <div className="reel-pop absolute right-0 top-0 rounded-xl rounded-bl-none bg-lamp px-2 py-1 text-center text-white shadow-md" style={at(1)}>
        <p className="text-[10px] font-bold leading-none">朝 6:30</p>
        <p className="text-lg font-black leading-tight">12cm</p>
      </div>
      <span className="reel-pop absolute bottom-1 right-0 rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white" style={at(2)}>
        3軒
      </span>
    </div>
  );
}

function Teams() {
  const spots = ["left-0 top-0", "right-0 top-0", "bottom-0 left-1/2 -translate-x-1/2"];
  return (
    <div className="relative h-full">
      {TEAMS.slice(0, 3).map((t, k) => (
        <span key={t.id} className={`absolute aspect-square w-[52%] ${spots[k]}`}>
          <span className="reel-pop block size-full" style={at(k)}>
            <Mascot team={t.id} className="size-full" />
          </span>
        </span>
      ))}
    </div>
  );
}

function MapArt() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
      <rect width="100" height="100" rx="14" fill="#eef3f7" />
      <path d="M-5 38 H105 M-5 74 H105 M36 -5 V105 M76 -5 V105" stroke="#fff" strokeWidth="8" />
      {[[8, 10], [48, 10], [8, 48], [48, 48], [84, 48], [48, 84]].map(([x, y], k) => (
        <rect key={k} x={x} y={y} width="18" height="16" rx="3" fill="#d5e1eb" />
      ))}
      <path d="M22 90 C22 70 56 74 58 34" fill="none" stroke="#29445c" strokeWidth="3" strokeDasharray="5 6" strokeLinecap="round" className="reel-dash" />
      <circle cx="22" cy="90" r="7" fill="#29445c" stroke="#fff" strokeWidth="2.5" />
      <g className="reel-pin" style={{ transformOrigin: "58px 34px" }}>
        <path d="M58 6 C48 6 44 13 44 19 C44 28 58 34 58 34 S72 28 72 19 C72 13 68 6 58 6 Z" fill="#d9825b" />
        <circle cx="58" cy="18" r="5" fill="#fff" />
      </g>
    </svg>
  );
}

function Photo() {
  return (
    <div className="relative h-full">
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
        <rect width="100" height="100" rx="14" fill="#eaf3fa" />
        <path d="M22 46 L50 24 L78 46 V84 H22 Z" fill="#f5eee5" stroke="#29445c" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M17 47 L50 20 L83 47" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        <rect x="43" y="60" width="14" height="24" rx="2" fill="#3b6584" />
        <path d="M0 84 H100 V100 H0 Z" fill="#fff" />
        <path d="M43 84 H57 L68 100 H32 Z" fill="#c9d8e4" />
        <path d="M24 92 C30 64 44 58 50 60 C60 58 72 66 76 92 Z" fill="#fff" stroke="#c9d8e4" strokeWidth="2" className="reel-melt" style={{ transformOrigin: "50px 92px" }} />
        <rect width="100" height="100" rx="14" fill="#fff" className="reel-flash" style={at(2)} />
      </svg>
      <span className="reel-pop absolute -right-1 -top-1 rotate-6 rounded-lg bg-lamp px-1.5 py-0.5 text-sm font-black text-white shadow-md" style={at(2.4)}>
        +10点
      </span>
    </div>
  );
}

const SCENES: { key: string; title: string; text: string; art: ReactNode }[] = [
  { key: "notice", title: "雪の朝、お知らせが届く", text: "10cm 積もった朝に。", art: <Notice /> },
  { key: "teams", title: "町内でランダム3チーム", text: "毎週ちがう顔ぶれで。", art: <Teams /> },
  { key: "map", title: "地図の家へ、10分だけ", text: "2人以上で、無理せず。", art: <MapArt /> },
  { key: "photo", title: "終わったら写真で完了", text: "カードと羽が届きます。", art: <Photo /> },
];

export default function ManualReel({ className = "" }: { className?: string }) {
  const [i, setI] = useState(0);
  const next = () => setI((n) => (n + 1) % SCENES.length);
  useEffect(() => {
    const t = window.setTimeout(next, SCENE_MS);
    return () => window.clearTimeout(t);
  }, [i]);

  return (
    <button
      type="button"
      onClick={next}
      aria-label={`使い方 ${i + 1}/${SCENES.length}: ${SCENES[i].title}。${SCENES[i].text} タップで次へ`}
      className={`block w-full rounded-3xl bg-card/95 px-3 pb-3 pt-2.5 text-left shadow-xl ${className}`}
      style={{ "--beat": `${BEAT_MS}ms` } as CSSProperties}
    >
      {/* いま何コマ目か（線が4拍かけて伸びる） */}
      <span className="flex items-center gap-1.5" aria-hidden="true">
        <span className="mr-1 shrink-0 text-xs font-black text-lamp-deep">▶ 使い方</span>
        {SCENES.map((s, k) => (
          <span key={s.key} className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink/15">
            <span key={k === i ? `on-${i}` : "off"} className={`block h-full origin-left rounded-full bg-lamp ${k === i ? "reel-fill" : k < i ? "" : "scale-x-0"}`} />
          </span>
        ))}
      </span>
      <span className="relative mt-2 block h-24 short:h-[76px]" aria-hidden="true">
        {SCENES.map((s, k) => (
          <span
            key={s.key}
            className={`reel-scene absolute inset-0 flex items-center gap-2 ${k === i ? "reel-on" : k < i ? "reel-past" : "reel-next"}`}
          >
            <span className="block aspect-square h-full shrink-0">{s.art}</span>
            <span className="min-w-0">
              <span className="reel-pop flex items-center gap-1.5">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-sm font-black text-white">{k + 1}</span>
                <b className="whitespace-nowrap text-base font-black leading-tight">{s.title}</b>
              </span>
              <span className="reel-pop mt-1 block text-base leading-snug short:text-sm" style={at(1)}>
                {s.text}
              </span>
            </span>
          </span>
        ))}
      </span>
    </button>
  );
}
