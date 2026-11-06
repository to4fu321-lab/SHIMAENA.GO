import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import LoginButton from "@/components/LoginButton";
import NakamaScreen from "@/components/NakamaScreen";
import StormBanner from "@/components/StormBanner";
import { nakamaView } from "@/lib/nakama/ops";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";
import Bgm from "@/components/Bgm";

export const metadata: Metadata = { title: "なかま ・ シマエナGO" };

async function Content({ searchParams }: { searchParams: Promise<{ as?: string; tab?: string }> }) {
  await connection();
  const { as, tab } = await searchParams;
  const initialTab = tab && /^[0-2]$/.test(tab) ? Number(tab) : undefined;
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer((await cookies()).get(VIEWER_COOKIE)?.value);
  const view = viewerId ? await nakamaView(viewerId, new Date()) : undefined;
  if (!viewerId || !view) {
    return (
      <main className="mx-auto min-h-dvh max-w-md space-y-4 bg-paper px-4 py-6 text-ink">
        <h1 className="text-2xl font-bold">なかま</h1>
        <p className="text-lg">登録した人の画面です。</p>
        <LoginButton next="/nakama" />
        <p className="text-base text-ink-soft">
          デモ: <Link href="/nakama?as=h3" className="underline">架空の手伝う側として開く</Link>
        </p>
      </main>
    );
  }
  return (
    <>
      <StormBanner />
      <NakamaScreen viewerId={viewerId} view={view} q={demoAs ? `?as=${demoAs}` : ""} initialTab={initialTab} />
    </>
  );
}

export default function NakamaPage({ searchParams }: { searchParams: Promise<{ as?: string; tab?: string }> }) {
  return (
    <>
      <Bgm track="morning" />
      <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
