"use client";

// ソロミッションの「開始！」「クリア！」の全画面演出（1.5秒ほどで消える）。
const COLORS = ["#8fb8c9", "#c8a7b8", "#d9825b", "#f5eee5", "#ffffff", "#2f4a5f"];

export default function MissionFlash({ kind, label }: { kind: "start" | "clear"; label: string }) {
  const start = kind === "start";
  return (
    <div
      className={`flash-bg fixed inset-0 z-[1300] grid place-items-center overflow-hidden ${start ? "bg-ink/90" : "bg-lamp/90"}`}
      role="status"
      aria-live="assertive"
    >
      <div className="flash-rays pointer-events-none absolute left-1/2 top-1/2 size-[180vmax]" aria-hidden="true" />
      {!start && (
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="confetti" style={{ left: `${3 + i * 7}%`, background: COLORS[i % COLORS.length], animationDelay: `${(i % 5) * 0.12}s` }} />
          ))}
        </div>
      )}
      <div className="relative text-center text-white">
        <p className="flash-sub text-lg font-bold tracking-widest">{start ? "MISSION START" : "MISSION COMPLETE"}</p>
        <p className="flash-stamp whitespace-nowrap text-6xl font-black drop-shadow-lg">{start ? "出撃！" : "クリア！"}</p>
        <p className="flash-sub mt-3 px-6 text-xl font-bold">{label}</p>
      </div>
    </div>
  );
}
