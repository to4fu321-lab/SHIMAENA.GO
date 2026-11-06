"use client";
// ホームのシマエナ隊長: 吹き出しで順番に話し（7秒ごと）、枝の上でゆれる。
// タップすると空へ飛んでいって、反対側から戻ってくる（戻ったら次のことばへ）。30秒ごとに自分でも飛ぶ。
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Mascot from "@/components/Mascot";
import { cheersSeenAction } from "@/app/home-actions";
import type { TeamId } from "@/lib/types";
import { play } from "@/lib/sound/engine";

const TALK_MS = 7000;
const FLY_MS = 2600;
const AUTO_FLY_MS = 30000;

export default function CaptainStage({
  lines: base,
  team,
  arrival = [],
  viewerId,
  chatHref = "/chat",
}: {
  lines: string[];
  /** 吹き出しを押すと隊長トークへ（11/6 本人の指示: 「隊長」タブだけでは相談できると分かりにくい） */
  chatHref?: string;
  team?: TeamId;
  /** 応援・おつかれさまが届いていたら、隊長が飛んできて先に話す（聞いたらしるしを付ける） */
  arrival?: string[];
  viewerId?: string;
}) {
  // 飛んできたときの文は、最初に開いたときのものを使い続ける（8秒ごとの更新で消えないように）
  const [arrived] = useState(arrival);
  const lines = [...arrived, ...base];
  const [i, setI] = useState(0);
  const [flying, setFlying] = useState(false);
  const [arriving, setArriving] = useState(arrived.length > 0);
  const flyingRef = useRef(false);

  useEffect(() => {
    if (arrived.length === 0) return;
    play("chirp", { delay: 1.2 }); // 飛んできて「おーい！」
    const t = window.setTimeout(() => setArriving(false), 2200);
    if (viewerId) {
      const fd = new FormData();
      fd.set("viewerId", viewerId);
      void cheersSeenAction(fd).catch(() => {});
    }
    return () => window.clearTimeout(t);
  }, [arrived.length, viewerId]);

  const next = useCallback(() => setI((n) => (n + 1) % Math.max(1, lines.length)), [lines.length]);

  const fly = useCallback(() => {
    if (flyingRef.current) return;
    flyingRef.current = true;
    setFlying(true);
    play("chirp");
    play("flap", { delay: 0.25 });
    window.setTimeout(() => {
      flyingRef.current = false;
      setFlying(false);
      next();
    }, FLY_MS);
  }, [next]);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (!flyingRef.current) next();
    }, TALK_MS);
    const f = window.setInterval(fly, AUTO_FLY_MS);
    return () => {
      window.clearInterval(t);
      window.clearInterval(f);
    };
  }, [next, fly]);

  const line = lines[i % Math.max(1, lines.length)] ?? "";

  return (
    <>
      {/* 吹き出し（しっぽは隊長の口元へ）。ことばが変わるたびにふわっと出る */}
      <div className="absolute left-3 top-2 z-10 max-w-[64%] short:top-1" aria-live="polite">
        <div key={`${i}-${flying}-${arriving}`} className={flying ? "speech-away" : "speech-pop"}>
          <Link href={chatHref} className="relative block rounded-3xl bg-card px-3.5 py-1.5 text-base font-bold leading-snug shadow-md ring-2 ring-ink/15 short:py-1">
            <span className="block text-xs font-bold text-lamp-deep">シマエナ隊長</span>
            {flying ? "いってくるしま〜！" : arriving ? "おーい！知らせがあるえな〜！" : line}
            <span className="mt-1 flex items-center gap-1 rounded-full bg-lamp px-2.5 py-0.5 text-sm font-bold text-white short:mt-0.5">
              <span aria-hidden="true">💬</span>隊長に相談する<span aria-hidden="true" className="ml-auto">›</span>
            </span>
          </Link>
          <svg viewBox="0 0 40 30" className="absolute -bottom-[20px] right-[6%] h-[24px] w-8" aria-hidden="true">
            <path d="M2 0 C10 10 24 22 38 28 C30 18 26 8 26 0 Z" fill="var(--card)" stroke="rgba(41,68,92,.15)" strokeWidth="2" strokeLinejoin="round" />
            <path d="M3 -2 H25 V3 H3 Z" fill="var(--card)" />
          </svg>
        </div>
      </div>
      {/* 枝 */}
      <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="absolute bottom-[14%] right-0 h-6 w-3/5" aria-hidden="true">
        <path d="M0 30 C60 22 120 18 200 8" stroke="#7a5a44" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M120 19 L150 2" stroke="#7a5a44" strokeWidth="5" strokeLinecap="round" />
        <path d="M10 26 C60 18 120 14 196 4" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
      </svg>
      {/* 隊長（タップで飛ぶ） */}
      <button
        type="button"
        onClick={fly}
        aria-label="シマエナ隊長（タップすると飛びます）"
        className="absolute bottom-[16%] right-[5%] h-[58%] max-h-36 min-h-16 cursor-pointer"
      >
        <span className={`block h-full ${flying ? "captain-fly" : arriving ? "captain-arrive" : "captain-idle"}`}>
          <Mascot team={team} className="h-full w-auto drop-shadow-md" />
        </span>
      </button>
    </>
  );
}
