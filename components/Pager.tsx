"use client";

// 1画面に収めるための共通の部品（11/5 本人の指示「基本1画面。縦に長いと理解力が要り、直感的でない」）。
// 上に大きいタブ、下は横スワイプのパネル。パネルは画面の残りの高さに収め、縦にはスクロールしない。
// 1つのパネルに入りきらない中身は、パネルを分けるか、パネルの中で ‹ › で1つずつ見せる（PagedList）。
import { Children, useEffect, useRef, useState, type ReactNode } from "react";

export interface PagerTab {
  key: string;
  label: string;
  /** タブに出す小さい数（届いた誘い など）。0 や undefined は出さない */
  badge?: number;
}

/** 画面全体の枠: 高さは画面ぴったり（h-dvh）。header と footer（TabBar など）の間を main が埋める */
export function Screen({ header, footer, children, className = "" }: { header?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-paper text-ink ${className}`}>
      {header && <div className="shrink-0">{header}</div>}
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
      {footer && <div className="shrink-0">{footer}</div>}
    </div>
  );
}

/**
 * タブ＋横スワイプのパネル。children の順番がタブの順番。
 * index を渡すと親から切り替えられる（例: 誘いが届いていたら「合流」を開く）。
 */
export default function Pager({
  tabs,
  children,
  initial = 0,
  index,
  onChange,
  className = "",
}: {
  tabs: PagerTab[];
  children: ReactNode;
  initial?: number;
  index?: number;
  onChange?: (i: number) => void;
  className?: string;
}) {
  const panels = Children.toArray(children);
  const [active, setActive] = useState(initial);
  const track = useRef<HTMLDivElement>(null);

  const goTo = (i: number, smooth = true) => {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: smooth ? "smooth" : "auto" });
    setActive(i);
    onChange?.(i);
  };
  useEffect(() => {
    goTo(initial, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (index !== undefined && index !== active) goTo(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) {
      setActive(i);
      onChange?.(i);
    }
  };

  return (
    <div className={`flex min-h-0 flex-1 flex-col ${className}`}>
      <div role="tablist" className="mx-4 mb-2 grid shrink-0 gap-1 rounded-2xl bg-ink/10 p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t, i) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={i === active}
            onClick={() => goTo(i)}
            className={`relative min-h-12 whitespace-nowrap rounded-xl px-1 text-base font-bold leading-tight ${tabs.length >= 4 ? "max-[400px]:px-0.5 max-[400px]:text-sm" : ""} ${i === active ? "bg-card text-ink shadow" : "text-ink-soft"}`}
          >
            {t.label}
            {t.badge ? (
              <span className="absolute -right-1 -top-1 grid min-w-6 place-items-center rounded-full bg-lamp px-1.5 text-sm text-white">{t.badge}</span>
            ) : null}
          </button>
        ))}
      </div>
      <div
        ref={track}
        onScroll={onScroll}
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {panels.map((p, i) => (
          <section
            key={tabs[i]?.key ?? i}
            role="tabpanel"
            aria-label={tabs[i]?.label}
            aria-hidden={i !== active}
            className="flex h-full w-full shrink-0 snap-center flex-col gap-2 overflow-hidden px-4 pb-2"
          >
            {p}
          </section>
        ))}
      </div>
    </div>
  );
}

/** パネルの中で、長い一覧を1つずつ（または n 個ずつ）‹ › で見せる。縦には伸ばさない */
export function PagedList<T>({
  items,
  per = 1,
  render,
  empty,
  label,
}: {
  items: T[];
  per?: number;
  render: (item: T, i: number) => ReactNode;
  empty?: ReactNode;
  label: string;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / per));
  const p = Math.min(page, pages - 1);
  if (items.length === 0) return <>{empty}</>;
  const shown = items.slice(p * per, p * per + per);
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" aria-label={label}>
      <div className="flex min-h-0 flex-1 flex-col gap-2">{shown.map((it, i) => render(it, p * per + i))}</div>
      {pages > 1 && (
        <div className="flex shrink-0 items-center justify-center gap-3">
          <button aria-label="前へ" disabled={p === 0} onClick={() => setPage(p - 1)} className="grid size-11 place-items-center rounded-full bg-card text-2xl font-bold shadow-sm ring-1 ring-ink/15 disabled:opacity-30">
            ‹
          </button>
          <span className="text-base font-bold tabular-nums">
            {p + 1} / {pages}
          </span>
          <button aria-label="次へ" disabled={p >= pages - 1} onClick={() => setPage(p + 1)} className="grid size-11 place-items-center rounded-full bg-card text-2xl font-bold shadow-sm ring-1 ring-ink/15 disabled:opacity-30">
            ›
          </button>
        </div>
      )}
    </div>
  );
}
