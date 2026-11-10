"use client";
// 雪かき中の印の動く時計（spec v1.12）。秒まで動くので、スクショの使い回しと見分けられる。
import { useEffect, useState } from "react";

function jstNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toLocaleTimeString("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

/** offsetMs: デモの夜は、雪かきができる時間にもどした時計（lib/clock.ts の appOffsetMs をサーバーで渡す） */
export default function LiveClock({ className = "", offsetMs = 0 }: { className?: string; offsetMs?: number }) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(jstNow(offsetMs));
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [offsetMs]);
  return (
    <p className={`tabular-nums ${className}`} aria-live="off">
      {now ?? "--:--:--"}
    </p>
  );
}
