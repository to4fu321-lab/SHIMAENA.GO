import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import LiffBridge from "@/components/LiffBridge";
import NakamaScreen from "@/components/NakamaScreen";
import StormBanner from "@/components/StormBanner";
import { nakamaView } from "@/lib/nakama/ops";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "なかま ・ シマエナGO" };

async function Content({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer((await cookies()).get(VIEWER_COOKIE)?.value);
  const view = viewerId ? await nakamaView(viewerId, new Date()) : undefined;
  if (!viewerId || !view) {
    return (
      <main className="mx-auto min-h-dvh max-w-md space-y-4 bg-paper px-4 py-6 text-ink">
        <LiffBridge liffId={process.env.NEXT_PUBLIC_LIFF_ID} enabled={!demoAs} />
        <h1 className="text-2xl font-bold">なかま</h1>
        <p className="text-lg">LINE で登録した人の画面です。LINE の「シマエナGO」から開いてください。</p>
        <p className="text-base text-ink-soft">
          デモ: <Link href="/nakama?as=h3" className="underline">架空の手伝う側として開く</Link>
        </p>
      </main>
    );
  }
  return (
    <>
      <LiffBridge liffId={process.env.NEXT_PUBLIC_LIFF_ID} enabled={!demoAs} />
      <StormBanner />
      <NakamaScreen viewerId={viewerId} view={view} q={demoAs ? `?as=${demoAs}` : ""} />
    </>
  );
}

export default function NakamaPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
