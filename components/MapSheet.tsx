"use client";

// 地図の下のシート。つまみを上下にスライド（またはタップ）で畳める。畳むと地図が大きく見える。
// peek = 畳んでも見える1行、children = 開いたときの中身（中でスクロール）、footer = 開いたときの下のボタン。
import { useRef, useState, type ReactNode } from "react";

export default function MapSheet({ peek, children, footer, startClosed = false }: { peek: ReactNode; children: ReactNode; footer?: ReactNode; startClosed?: boolean }) {
  const [open, setOpen] = useState(!startClosed);
  const start = useRef<{ y: number; moved: boolean } | null>(null);

  const down = (e: React.PointerEvent) => {
    start.current = { y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dy = e.clientY - s.y;
    if (Math.abs(dy) > 24) {
      s.moved = true;
      setOpen(dy < 0); // 上へ = 開く、下へ = 畳む
      s.y = e.clientY;
    }
  };
  const up = () => {
    const s = start.current;
    start.current = null;
    if (s && !s.moved) setOpen((o) => !o); // 動かさずに離した = タップ
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
        aria-label={open ? "シートを畳んで地図を大きくする" : "シートを開く"}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => (start.current = null)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setOpen((o) => !o)}
        className="shrink-0 cursor-grab touch-none select-none px-4 pb-2 pt-2"
      >
        <span className="mx-auto mb-1.5 block h-1.5 w-14 rounded-full bg-ink/25" aria-hidden="true" />
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">{peek}</div>
          <span className="shrink-0 text-sm font-bold text-ink-soft" aria-hidden="true">
            {open ? "▼ 畳む" : "▲ ひらく"}
          </span>
        </div>
      </div>
      <div
        className="flex min-h-0 flex-col overflow-hidden transition-[max-height] duration-300 ease-out"
        style={{ maxHeight: open ? "calc(52dvh - 56px)" : 0 }}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3">{children}</div>
        {footer && <div className="shrink-0 border-t border-ink/10 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-2">{footer}</div>}
      </div>
      {!open && <div className="h-[max(8px,env(safe-area-inset-bottom))]" />}
    </section>
  );
}
