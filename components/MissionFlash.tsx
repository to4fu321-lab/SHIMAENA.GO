"use client";

// ソロミッションの「GO！」「クリア！」の全画面演出（1.5秒ほどで消える）。
// 開始は種類ごとに変える（11/7 本人の指示）: 自宅の雪かき＝「雪かきGO！」（雪が四方へ飛び、白い帯が雪をどける）、
// 道の危険＝「お知らせGO！」（知らせの波紋が広がる）。
import { useEffect } from "react";
import { play } from "@/lib/sound/engine";
const COLORS = ["#8fb8c9", "#c8a7b8", "#d9825b", "#f5eee5", "#ffffff", "#2f4a5f"];

const START = {
  own_house: { stamp: "雪かきGO！", sub: "SNOW GO!", icon: "🏠", bg: "bg-ink/90" },
  report_snow: { stamp: "お知らせGO！", sub: "ALERT GO!", icon: "📣", bg: "bg-camellia-deep/90" },
} as const;
const FALLBACK = { stamp: "GO！", sub: "MISSION START", icon: "❄️", bg: "bg-ink/90" };

/** 雪が中心から四方へ飛ぶ向き（16方向） */
const FLAKES = Array.from({ length: 16 }, (_, i) => {
  const a = (i / 16) * Math.PI * 2;
  const r = 140 + (i % 3) * 50;
  return { dx: Math.round(Math.cos(a) * r), dy: Math.round(Math.sin(a) * r), delay: (i % 4) * 0.06, size: 18 + (i % 3) * 8 };
});

export default function MissionFlash({ kind, label, go }: { kind: "start" | "clear"; label: string; go?: string }) {
  const start = kind === "start";
  const look = start ? (START[go as keyof typeof START] ?? FALLBACK) : null;
  const notice = go === "report_snow";
  // 音: GO！はドーン、「クリア！」はファンファーレ（flash-stamp の 0.1s に合わせる）
  useEffect(() => {
    play(start ? "missionStart" : "missionClear", { delay: 0.1 });
  }, [start]);
  return (
    <div
      className={`flash-bg fixed inset-0 z-[1300] grid place-items-center overflow-hidden ${look ? look.bg : "bg-lamp/90"}`}
      role="status"
      aria-live="assertive"
    >
      <div className="flash-rays pointer-events-none absolute left-1/2 top-1/2 size-[180vmax]" aria-hidden="true" />
      {look && !notice && (
        // 雪かきGO！: 雪が四方へ飛び、白い帯がさっと雪をどける
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <span className="go-wipe absolute inset-y-0 w-1/2 bg-white/25" />
          {FLAKES.map((f, i) => (
            <span
              key={i}
              className="go-flake absolute left-1/2 top-1/2 text-white"
              style={{ "--dx": `${f.dx}px`, "--dy": `${f.dy}px`, animationDelay: `${f.delay}s`, fontSize: f.size } as React.CSSProperties}
            >
              ❄
            </span>
          ))}
        </div>
      )}
      {look && notice && (
        // お知らせGO！: 知らせの波紋が3重に広がる
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {[0, 0.35, 0.7].map((d) => (
            <span key={d} className="go-ring absolute left-1/2 top-1/2 size-40 rounded-full border-4 border-white/70" style={{ animationDelay: `${d}s` }} />
          ))}
        </div>
      )}
      {!start && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="confetti" style={{ left: `${3 + i * 7}%`, background: COLORS[i % COLORS.length], animationDelay: `${(i % 5) * 0.12}s` }} />
          ))}
        </div>
      )}
      <div className="relative text-center text-white">
        {look && <p className="go-icon mb-1 text-6xl" aria-hidden="true">{look.icon}</p>}
        <p className="flash-sub text-lg font-bold tracking-widest">{look ? look.sub : "MISSION COMPLETE"}</p>
        <p className="flash-stamp whitespace-nowrap text-6xl font-black drop-shadow-lg max-[400px]:text-5xl">{look ? look.stamp : "クリア！"}</p>
        <p className="flash-sub mt-3 px-6 text-xl font-bold">{label}</p>
      </div>
    </div>
  );
}
