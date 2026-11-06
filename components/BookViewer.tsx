"use client";

// 町の週刊絵本の読みもの（spec v1.27）: 表紙 → 6ページ → おしまい。横にめくる（スワイプ・‹ ›・← →）。
// めくるたびに紙が起き上がる動きと音。🔊 で、いまのページをブラウザの日本語の声で読む（隊長トークと同じ読み上げ）。
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { canSpeak, speak } from "./ChatTools";
import { useClientValue } from "./useClientValue";
import { play } from "@/lib/sound/engine";

export interface ViewerPage {
  text: string;
  src: string;
  claude: boolean;
}

export interface ViewerBook {
  weekStart: string;
  title: string;
  subtitle: string;
  cover: ViewerPage;
  pages: ViewerPage[];
  status: "drawing" | "done";
  drawn: number;
  total: number;
  by: "claude" | "template";
}

export default function BookViewer({ book, others }: { book: ViewerBook; others: { weekStart: string; title: string; span: string }[] }) {
  const slides = book.pages.length + 2; // 表紙・ページ・おしまい
  const [active, setActive] = useState(0);
  const [turn, setTurn] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  const voice = useClientValue(false, canSpeak);

  const goTo = (i: number) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(slides - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (!el || el.clientWidth === 0) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== active) {
      setActive(i);
      setTurn((t) => t + 1);
      play("cardFlip");
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goTo(active + 1);
      if (e.key === "ArrowLeft") goTo(active - 1);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  // ページを変えたら読み上げを止める
  useEffect(() => {
    if (canSpeak()) window.speechSynthesis.cancel();
  }, [active]);

  const read = () => {
    if (active === 0) speak(`${book.title}。${book.subtitle}`);
    else if (active <= book.pages.length) speak(book.pages[active - 1].text);
    else speak("おしまい。");
  };

  const img = (p: ViewerPage, alt: string, big = false) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={p.src} alt={alt} className={`mx-auto block aspect-[4/3] w-full rounded-2xl bg-white object-cover shadow-md ring-1 ring-ink/10 ${big ? "max-h-[52dvh]" : "max-h-[44dvh]"} max-w-[calc(44dvh*4/3)]`} />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {book.status === "drawing" && (
        <p className="mx-4 mb-1 shrink-0 rounded-xl bg-warm px-3 py-1 text-center text-sm font-bold" role="status">
          Claude がさし絵をゼロから描いています（{book.drawn}/{book.total}）
        </p>
      )}
      <div ref={track} onScroll={onScroll} className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none]">
        {/* 表紙 */}
        <section className="flex w-full shrink-0 snap-center flex-col justify-center gap-3 px-4 text-center" aria-label="表紙">
          <div>
            <p className="text-sm font-bold tracking-widest text-ink-soft">シマエナGO 週刊絵本</p>
            <h2 className="text-[28px] font-bold leading-tight [text-wrap:balance]">{book.title}</h2>
          </div>
          <div key={active === 0 ? turn : "c"} className={active === 0 ? "book-turn" : ""}>
            {img(book.cover, "表紙の絵", true)}
          </div>
          <p className="text-lg font-bold">{book.subtitle}</p>
          <p className="text-base text-ink-soft">
            {book.by === "claude" ? "文と絵: Claude（今週の町の記録から）" : "今週の町の記録から"} ・ 横にめくってね ›
          </p>
        </section>
        {/* ページ */}
        {book.pages.map((p, i) => (
          <section key={i} className="flex w-full shrink-0 snap-center flex-col justify-center gap-3 px-4" aria-label={`${i + 1}ページ`}>
            <div key={active === i + 1 ? turn : "p"} className={`relative overflow-hidden rounded-2xl ${active === i + 1 ? "book-turn" : ""}`}>
              {img(p, `${i + 1}ページの絵`)}
              {active === i + 1 && <span className="book-shade pointer-events-none absolute inset-0" aria-hidden="true" />}
            </div>
            <p className="text-[20px] font-bold leading-relaxed [text-wrap:pretty]">{p.text}</p>
            <p className="text-right text-sm text-ink-soft">
              {i + 1} / {book.pages.length}
              {p.claude ? " ・ 絵: Claude" : ""}
            </p>
          </section>
        ))}
        {/* おしまい */}
        <section className="flex w-full shrink-0 snap-center flex-col justify-center gap-3 px-6 text-center" aria-label="おしまい">
          <p className="text-4xl font-bold">おしまい</p>
          <p className="text-lg">また雪の朝に、どこかの玄関で。</p>
          <Link href={`/book/print?week=${book.weekStart}`} className="btn btn-white mx-auto min-h-12 px-5 text-lg">
            🖨 印刷して届ける
          </Link>
          {others.length > 1 && (
            <div className="space-y-1">
              <p className="text-sm text-ink-soft">ほかの週の絵本</p>
              <div className="flex flex-wrap justify-center gap-2">
                {others
                  .filter((o) => o.weekStart !== book.weekStart)
                  .slice(0, 4)
                  .map((o) => (
                    <Link key={o.weekStart} href={`/book?week=${o.weekStart}`} className="rounded-full bg-card px-3 py-1 text-base ring-1 ring-ink/10">
                      {o.span}
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </section>
      </div>
      {/* めくる・読む */}
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-2">
        <button type="button" onClick={() => goTo(active - 1)} disabled={active === 0} className="btn btn-white min-h-12 w-16 text-2xl disabled:opacity-30" aria-label="前のページ" data-sound="none">
          ‹
        </button>
        <div className="flex min-w-0 items-center gap-1" aria-hidden="true">
          {Array.from({ length: slides }, (_, i) => (
            <span key={i} className={`size-1.5 shrink-0 rounded-full ${i === active ? "bg-ink" : "bg-ink/20"}`} />
          ))}
        </div>
        {voice && (
          <button type="button" onClick={read} className="btn btn-white min-h-12 shrink-0 whitespace-nowrap px-3 text-lg" aria-label="このページを読み上げる">
            🔊 読む
          </button>
        )}
        <button type="button" onClick={() => goTo(active + 1)} disabled={active === slides - 1} className="btn btn-white min-h-12 w-16 text-2xl disabled:opacity-30" aria-label="次のページ" data-sound="none">
          ›
        </button>
      </div>
    </div>
  );
}
