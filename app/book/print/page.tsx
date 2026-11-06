// 週刊絵本の印刷用（spec v1.27）: スマホのないおじいちゃん・おばあちゃんに、家族が印刷して届ける。
// 1枚に1ページ（絵と大きな文字）。印刷するためのページなので、ここだけは縦に長くてよい。
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import PrintButton from "@/components/PrintButton";
import { currentWeekStart } from "@/lib/book/make";
import { loadBook } from "@/lib/book/store";
import { viewerOf } from "@/lib/book/viewer";

export const metadata: Metadata = { title: "絵本を印刷 ・ シマエナGO" };

async function PrintContent({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  await connection();
  const { week } = await searchParams;
  const ws = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : await currentWeekStart();
  const b = await loadBook(ws);
  if (!b) return <p className="p-6 text-xl">この週の絵本はまだありません。</p>;
  const v = viewerOf(b);
  return (
    <div className="mx-auto max-w-2xl bg-white text-ink">
      <div className="book-noprint flex items-center justify-between gap-2 p-4">
        <Link href={`/book?week=${b.weekStart}`} className="btn btn-white min-h-11 px-3 text-base">
          ‹ 絵本へ
        </Link>
        <PrintButton />
      </div>
      <section className="book-sheet flex min-h-[90vh] flex-col items-center justify-center gap-6 p-8 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={v.cover.src} alt="表紙の絵" className="w-full rounded-2xl" />
        <p className="text-base tracking-widest">シマエナGO 週刊絵本</p>
        <h1 className="text-4xl font-bold leading-tight">{b.title}</h1>
        <p className="text-2xl">{b.subtitle}</p>
      </section>
      {v.pages.map((p, i) => (
        <section key={i} className="book-sheet flex min-h-[90vh] flex-col justify-center gap-6 p-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.src} alt={`${i + 1}ページの絵`} className="w-full rounded-2xl" />
          <p className="text-[28px] font-bold leading-relaxed">{p.text}</p>
          <p className="text-right text-lg">
            {i + 1} / {v.pages.length}
          </p>
        </section>
      ))}
      <section className="book-sheet flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-5xl font-bold">おしまい</p>
        <p className="text-2xl">また雪の朝に、どこかの玄関で。</p>
      </section>
    </div>
  );
}

export default function BookPrintPage(props: { searchParams: Promise<{ week?: string }> }) {
  return (
    <Suspense>
      <PrintContent {...props} />
    </Suspense>
  );
}
