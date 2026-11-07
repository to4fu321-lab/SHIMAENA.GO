"use client";

// 数字が 0 から数えあがる（チーム画面の成績・完了画面）。prefers-reduced-motion のときはすぐ最後の数
import { useEffect, useState } from "react";

export default function CountUp({ to, delay = 300, ms = 900, className = "" }: { to: number; delay?: number; ms?: number; className?: string }) {
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
    <span key={n === to ? "done" : "run"} className={`inline-block tabular-nums ${n === to && to > 0 ? "count-pop" : ""} ${className}`}>
      {n}
    </span>
  );
}
