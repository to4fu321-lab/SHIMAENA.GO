"use client";

// はじめてログインした人へのオープニング（/start で、登録の前に1回だけ）。
// ①雪の夜: 「タップしてはじめる」（スマホは最初のタップまで音を出せないので、ここで音を解放する）
// ②タップ: ドーン → 夜が明けて日がのぼり、家の灯りが1軒ずつともる。隊長が飛んできて、雪と紙ふぶきがはじける。
//    BGM は「灯りがともる」（ファンファーレつき）。名前が1文字ずつ跳ねて出て、このゲームの3つの柱が順に出る
// ③「隊員登録へ」で登録（役割 → 家の場所 → 2問）に進む
import { useEffect, useRef, useState } from "react";
import { requestBgm } from "@/lib/sound/bgm";
import { play } from "@/lib/sound/engine";
import Mascot from "./Mascot";
import SnowScene from "./SnowScene";

// はじける雪と紙ふぶき（向きと色。赤と緑は使わない）
const BURST = Array.from({ length: 26 }, (_, i) => {
  const a = (i / 26) * Math.PI * 2;
  const r = 110 + ((i * 37) % 90);
  return {
    dx: Math.round(Math.cos(a) * r),
    dy: Math.round(Math.sin(a) * r * 0.9 - 40),
    color: ["#ffffff", "#ffd27a", "#c8a7b8", "#8fb8c9", "#d9825b", "#ffffff"][i % 6],
    w: i % 3 === 0 ? 8 : 6,
    h: i % 3 === 0 ? 14 : 6,
    round: i % 3 !== 0,
    delay: (i % 4) * 0.05,
  };
});
const CONFETTI = Array.from({ length: 18 }, (_, i) => ({
  left: (i * 23 + 5) % 100,
  color: ["#ffd27a", "#c8a7b8", "#8fb8c9", "#ffffff", "#d9825b"][i % 5],
  delay: 0.6 + (i % 6) * 0.35,
  dur: 3 + (i % 4) * 0.6,
}));
const PILLARS = [
  { icon: "❄️", text: "雪の朝、点呼が届く" },
  { icon: "👥", text: "町内ランダム3チーム" },
  { icon: "🏠", text: "ひとり暮らしの家を救う" },
];

export default function WelcomeOpening({ name, onDone }: { name: string; onDone: () => void }) {
  const [stage, setStage] = useState<"cover" | "reveal">("cover");
  const release = useRef<(() => void) | null>(null);
  useEffect(() => () => release.current?.(), []);

  const start = () => {
    if (stage !== "cover") return;
    setStage("reveal");
    play("missionStart");
    play("welcome", { delay: 0.75 });
    play("cardSparkle", { delay: 1.3 });
    play("cheer", { delay: 2.1 });
    // 灯りがともる（ファンファーレから始まる曲）。登録に進んだら、ページの BGM（しらかばの朝）に戻す
    release.current = requestBgm("clear");
  };
  const done = () => {
    release.current?.();
    release.current = null;
    onDone();
  };

  const who = name ? `${name}隊員` : "新しい隊員";
  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden text-white"
      onClick={stage === "cover" ? start : undefined}
      role={stage === "cover" ? "button" : undefined}
      aria-label={stage === "cover" ? "タップしてはじめる" : undefined}
      data-sound="none"
    >
      <SnowScene phase={stage === "cover" ? "night" : "dawn"} />

      {stage === "cover" ? (
        <div className="relative flex min-h-0 flex-1 flex-col items-center px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-[12dvh] text-center">
          <p className="opening-rise rounded-full bg-white/15 px-4 py-1 text-sm font-bold ring-1 ring-white/30" style={{ animationDelay: "0.1s" }}>
            ✓ LINE でログインできました
          </p>
          <h1 className="opening-logo mt-4 whitespace-nowrap text-5xl font-black tracking-tight max-[380px]:text-4xl">
            シマエナ<span className="text-[#ffb98a]">GO</span>
          </h1>
          <p className="opening-rise mt-2 text-lg font-bold text-white/90 [text-shadow:0_1px_6px_rgba(12,28,46,0.9)]" style={{ animationDelay: "0.5s" }}>
            寒い冬は、くっついて乗り切る。
          </p>
          <Mascot size={132} className="captain-idle mt-[5dvh] drop-shadow-[0_6px_16px_rgba(0,0,0,0.35)] short:mt-3 short:size-28" />
          <p className="opening-rise mt-3 text-2xl font-bold leading-snug" style={{ animationDelay: "0.9s" }}>
            {name ? `${name}さん、` : ""}ようこそ
          </p>
          <p className="opening-rise mt-auto rounded-full bg-ink/50 px-3 py-0.5 text-sm font-bold text-white" style={{ animationDelay: "1.2s" }}>
            🔊 音が出ます
          </p>
          <span className="opening-tap mb-[6dvh] mt-2 inline-flex min-h-16 items-center justify-center gap-2 rounded-full bg-lamp px-8 text-xl font-black shadow-[0_0_0_6px_rgba(255,255,255,0.18),0_10px_30px_rgba(217,130,91,0.55)]">
            ▶ タップしてはじめる
          </span>
        </div>
      ) : (
        <div className="relative flex min-h-0 flex-1 flex-col items-center px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[7dvh] text-center text-ink">
          {/* 白い光 */}
          <span className="opening-flash pointer-events-none absolute inset-0 bg-white" />
          <p className="opening-rise rounded-full bg-white/80 px-4 py-1 text-sm font-black tracking-widest text-lamp-deep shadow-sm" style={{ animationDelay: "0.35s" }}>
            WELCOME TO THE TEAM
          </p>
          <h1 className="mt-3 text-[2.6rem] font-black leading-tight drop-shadow-[0_2px_0_rgba(255,255,255,0.9)] max-[380px]:text-4xl">
            {Array.from("ようこそ！").map((c, i) => (
              <span key={i} className="opening-char inline-block" style={{ animationDelay: `${0.5 + i * 0.08}s` }}>
                {c}
              </span>
            ))}
          </h1>
          <p className="opening-name mt-1 max-w-full truncate rounded-2xl bg-ink px-5 py-1 text-2xl font-black text-white shadow-lg" style={{ animationDelay: "1s" }}>
            {who}
          </p>
          {/* 隊長が空の向こうから飛んでくる＋雪がはじける */}
          <div className="relative mt-[3dvh] grid place-items-center short:mt-1">
            {BURST.map((b, i) => (
              <span
                key={i}
                className="opening-burst absolute"
                style={{
                  width: b.w,
                  height: b.h,
                  background: b.color,
                  borderRadius: b.round ? 999 : 2,
                  animationDelay: `${0.9 + b.delay}s`,
                  ["--dx" as string]: `${b.dx}px`,
                  ["--dy" as string]: `${b.dy}px`,
                }}
              />
            ))}
            <Mascot size={128} mood="happy" className="captain-arrive relative drop-shadow-[0_8px_14px_rgba(41,68,92,0.35)] short:size-24" />
          </div>
          <ul className="mt-[3dvh] w-full space-y-2 short:mt-2 short:space-y-1.5">
            {PILLARS.map((p, i) => (
              <li
                key={p.text}
                className="opening-pillar flex items-center gap-3 rounded-2xl bg-white/90 px-4 py-2 text-left text-lg font-bold shadow-md ring-1 ring-white short:py-1.5"
                style={{ animationDelay: `${1.6 + i * 0.35}s` }}
              >
                <span className="text-2xl" aria-hidden="true">
                  {p.icon}
                </span>
                {p.text}
              </li>
            ))}
          </ul>
          <button onClick={done} data-sound="go" className="opening-cta btn btn-lamp btn-big mt-auto w-full rounded-full text-2xl">
            隊員登録へ（30秒）›
          </button>
          {CONFETTI.map((c, i) => (
            <span key={i} className="confetti" style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s` }} />
          ))}
        </div>
      )}
    </div>
  );
}
