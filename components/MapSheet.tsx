"use client";

// 地図の下のシート。つまみを上下にスライド（またはタップ）で 3 段: 畳む／半分／全部（11/15 本人の指示「上スワイプで全部出るように」）。
// 畳むと地図が大きく見え、全部にすると中身がほぼ画面いっぱいに見える。
// peek = 畳んでも見える1行、children = 開いたときの中身（中でスクロール）、footer = 開いたときの下のボタン。
import { useRef, useState, type ReactNode } from "react";

export default function MapSheet({ peek, children, footer, startClosed = false }: { peek: ReactNode; children: ReactNode; footer?: ReactNode; startClosed?: boolean }) {
  // 0 = 畳む、1 = 半分、2 = 全部
  const [level, setLevel] = useState<0 | 1 | 2>(startClosed ? 0 : 1);
  const open = level > 0;
  const step = (d: 1 | -1) => setLevel((l) => Math.max(0, Math.min(2, l + d)) as 0 | 1 | 2);
  const start = useRef<{ y: number; moved: boolean } | null>(null);

  const down = (e: React.PointerEvent) => {
    start.current = { y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dy = e.clientY - s.y;
    if (Math.abs(dy) > 24 && !s.moved) {
      s.moved = true; // 1回のスワイプで1段（上へ = 広げる、下へ = 畳む）
      step(dy < 0 ? 1 : -1);
    }
  };
  const up = () => {
    const s = start.current;
    start.current = null;
    if (s && !s.moved) setLevel((l) => (l === 1 ? 2 : 1)); // 動かさずに離した = タップ（畳む・全部 → 半分、半分 → 全部）
  };

  return (
    <section
      className="absolute inset-x-0 bottom-0 z-[600] flex flex-col rounded-t-3xl bg-card shadow-[0_-6px_20px_rgba(41,68,92,0.18)]"
      aria-label="今朝のようすと操作"
    >
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={level === 2 ? "シートを半分に戻す" : level === 1 ? "シートを全部ひらく（下へスライドで畳む）" : "シートを開く"}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => (start.current = null)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setLevel((l) => (l === 1 ? 2 : 1))}
        className="shrink-0 cursor-grab touch-none select-none px-4 pb-2 pt-2"
      >
        <span className="mx-auto mb-1.5 block h-1.5 w-14 rounded-full bg-ink/25" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{peek}</div>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink/5 text-sm font-bold text-ink-soft" aria-hidden="true">
            {level === 2 ? "▼" : "▲"}
          </span>
        </div>
      </div>
      <div
        className="flex min-h-0 flex-col overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{ maxHeight: level === 2 ? "calc(100dvh - 150px)" : level === 1 ? "calc(52dvh - 56px)" : 0 }}
        aria-hidden={!open}
        inert={!open}
      >
        {/* 下の端をうすくして「まだ続く」と分かるように（下の帯に文字が半分隠れて見えないように） */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-6 [mask-image:linear-gradient(to_bottom,black_calc(100%-28px),transparent)]">{children}</div>
        {footer && <div className="shrink-0 border-t border-ink/10 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">{footer}</div>}
      </div>
      {!open && <div className="h-[max(8px,env(safe-area-inset-bottom))]" />}
    </section>
  );
}
