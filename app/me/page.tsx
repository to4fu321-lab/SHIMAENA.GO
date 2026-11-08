// マイページ（spec v1.32）: アイコン・プロフィール・好きなこと・興味（隊長のインタビューで作る）、なかま帳、記録。
// 登録した人の画面。デモは ?as=h1 など。
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import Bgm from "@/components/Bgm";
import LoginButton from "@/components/LoginButton";
import MyPageScreen from "@/components/MyPageScreen";
import StormBanner from "@/components/StormBanner";
import { mypageView } from "@/lib/mypage/ops";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "マイページ ・ シマエナGO" };

async function Content({ searchParams }: { searchParams: Promise<{ as?: string; tab?: string }> }) {
  await connection();
  const { as, tab } = await searchParams;
  const initialTab = tab && /^[0-2]$/.test(tab) ? Number(tab) : undefined;
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer((await cookies()).get(VIEWER_COOKIE)?.value);
  const view = viewerId ? await mypageView(viewerId, new Date()) : undefined;
  if (!viewerId || !view) {
    return (
      <main className="mx-auto min-h-dvh max-w-md space-y-4 bg-paper px-4 py-6 text-ink">
        <h1 className="text-2xl font-bold">マイページ</h1>
        <p className="text-lg">登録した人の画面です。アイコンと紹介、一緒に活動した仲間の記録が見られます。</p>
        <LoginButton next="/me" />
        <p className="text-base text-ink-soft">
          デモ: <Link href="/demo?next=%2Fme" className="underline">架空の10人からえらんで開く</Link>
        </p>
      </main>
    );
  }
  return (
    <>
      <StormBanner />
      <MyPageScreen viewerId={viewerId} view={view} q={demoAs ? `?as=${demoAs}` : ""} initialTab={initialTab} />
    </>
  );
}

export default function MePage({ searchParams }: { searchParams: Promise<{ as?: string; tab?: string }> }) {
  return (
    <>
      <Bgm track="morning" />
      <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
        <Content searchParams={searchParams} />
      </Suspense>
    </>
  );
}
