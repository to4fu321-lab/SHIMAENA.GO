// 広める（11/6 本人の指示で「くわしく」を整理）: 活動カードの「広める」から開く。
// 投稿 = 画像つきで SNS に（自動では投稿しない）、誘う = LINE などで友だちを誘う・応援を頼む。1画面（タブで切りかえ）
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import TabBar from "@/components/TabBar";
import Pager, { Screen } from "@/components/Pager";
import FriendShare from "@/components/FriendShare";
import SnsShare, { type ShareOption } from "@/components/SnsShare";
import { loadPublicStats } from "@/lib/public/load";
import { loadMeStats } from "@/lib/sns/me";
import { shareTextsFor } from "@/lib/sns/refresh";
import { mockShareText } from "@/lib/sns/text";
import { baseUrl } from "@/lib/url";
import { loadRoster } from "@/lib/morning/roster";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";
import Bgm from "@/components/Bgm";

export const metadata: Metadata = { title: "広める ・ シマエナGO" };

async function ShareContent({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [roster, cookieStore] = await Promise.all([loadRoster(), cookies()]);
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  const q = demoAs ? `?as=${demoAs}` : "";

  // SNS に投稿する下書き（数字は集計だけ）
  const stats = await loadPublicStats();
  const site = baseUrl();
  const texts = await shareTextsFor(stats);
  const shareOptions: ShareOption[] = [
    { key: "today", label: "今日の出動", text: texts.today.text, image: "/api/share/today.png", page: `${site}/public/share/today?via=sns` },
    { key: "town", label: "町の雪解け", text: texts.town.text, image: "/api/share/town.png", page: `${site}/public/share/town?via=sns` },
    { key: "recruit", label: "仲間を募集", text: texts.recruit.text, image: "/api/share/recruit.png", page: `${site}/public/share/recruit?via=sns` },
  ];
  if (me) {
    const meStats = await loadMeStats(me.id);
    shareOptions.unshift({
      key: "me",
      label: "わたしの活動",
      text: mockShareText("me", stats, meStats),
      image: `/api/share/me.png${demoAs ? `?as=${demoAs}` : ""}`,
      page: `${site}/public/share/today?via=sns`,
    });
  }

  return (
    <Screen
      header={
        <header className="flex items-center gap-2 bg-card px-2 py-2 shadow-sm">
          <Link href={`/cards${q}`} className="btn min-h-12 px-3 text-base">
            ‹ 活動
          </Link>
          <h1 className="text-xl font-bold">広める</h1>
        </header>
      }
      footer={<TabBar active="card" q={q} />}
    >
      <div className="h-2 shrink-0" />
      <Pager
        tabs={[
          { key: "post", label: "SNS に投稿" },
          { key: "invite", label: "友だちを誘う" },
        ]}
      >
        <SnsShare key="post" options={shareOptions} fill />
        <div key="invite" className="flex min-h-0 flex-1 flex-col gap-2">
          <FriendShare />
        </div>
      </Pager>
    </Screen>
  );
}

export default function SharePage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <>
      <Bgm track="morning" />
      <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-paper text-ink">読み込み中…</main>}>
        <ShareContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
