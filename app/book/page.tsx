import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import AutoRefresh from "@/components/AutoRefresh";
import BookViewer from "@/components/BookViewer";
import { Screen } from "@/components/Pager";
import TabBar from "@/components/TabBar";
import { currentWeekStart } from "@/lib/book/make";
import { listBooks, loadBook } from "@/lib/book/store";
import { viewerOf } from "@/lib/book/viewer";

export const metadata: Metadata = { title: "町の週刊絵本 ・ シマエナGO" };

async function BookContent({ searchParams }: { searchParams: Promise<{ week?: string; as?: string }> }) {
  await connection();
  const { week, as } = await searchParams;
  const q = as ? `?as=${as}` : "";
  const others = await listBooks();
  const wanted = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : await currentWeekStart();
  const book = (await loadBook(wanted)) ?? (others[0] && !week ? await loadBook(others[0].weekStart) : undefined);
  return (
    <Screen
      header={
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <h1 className="text-2xl font-bold">町の週刊絵本</h1>
          <Link href={`/${q}`} className="btn btn-white min-h-11 px-3 text-sm">
            ‹ ホーム
          </Link>
        </div>
      }
      footer={<TabBar active="home" q={q} />}
    >
      {book ? (
        <>
          {book.status === "drawing" && <AutoRefresh seconds={8} />}
          <BookViewer book={viewerOf(book)} others={others} />
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-2xl font-bold">まだ今週の絵本はありません</p>
          <p className="text-lg leading-relaxed">日曜の夜、1週間の雪かきの記録から、Claude が文と絵をつくって絵本にします。</p>
        </div>
      )}
    </Screen>
  );
}

export default function BookPage(props: { searchParams: Promise<{ week?: string; as?: string }> }) {
  return (
    <Suspense>
      <BookContent {...props} />
    </Suspense>
  );
}
