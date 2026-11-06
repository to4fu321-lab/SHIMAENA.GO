// つなぐ（11/6 本人の指示。spec v1.22）: 広める・誘う・バトン・なかまを1つの画面に。下のタブからいつでも開ける。
// 前の「広める」（/share）はここに統合（/share は転送）。
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import Bgm from "@/components/Bgm";
import ConnectScreen from "@/components/ConnectScreen";
import Icon from "@/components/Icon";
import { Screen } from "@/components/Pager";
import type { ShareOption } from "@/components/SnsShare";
import StormBanner from "@/components/StormBanner";
import TabBar from "@/components/TabBar";
import { inviteResultLine, readInviteStats } from "@/lib/invite";
import { loadRoster } from "@/lib/morning/roster";
import { nakamaView } from "@/lib/nakama/ops";
import { loadPublicStats } from "@/lib/public/load";
import { loadMeStats } from "@/lib/sns/me";
import { shareTextsFor } from "@/lib/sns/refresh";
import { mockShareText } from "@/lib/sns/text";
import { baseUrl } from "@/lib/url";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "つなぐ ・ シマエナGO" };

const TABS = ["post", "invite", "baton", "nakama"];

async function ConnectContent({ searchParams }: { searchParams: Promise<{ as?: string; tab?: string }> }) {
  await connection();
  const { as, tab } = await searchParams;
  const [roster, cookieStore] = await Promise.all([loadRoster(), cookies()]);
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  const q = demoAs ? `?as=${demoAs}` : "";
  const initialTab = Math.max(0, TABS.indexOf(tab ?? ""));

  // SNS に投稿する下書き（数字は集計だけ）。本人の「わたしの活動」は先頭に
  const stats = await loadPublicStats();
  const site = baseUrl();
  const [texts, nakama, meStats, invites] = await Promise.all([
    shareTextsFor(stats),
    me ? nakamaView(me.id, new Date()).catch(() => undefined) : undefined,
    me ? loadMeStats(me.id).catch(() => undefined) : undefined,
    me ? readInviteStats(me.id).catch(() => undefined) : undefined,
  ]);
  const shareOptions: ShareOption[] = [
    { key: "today", label: "今日の出動", text: texts.today.text, image: "/api/share/today.png", page: `${site}/public/share/today?via=sns` },
    { key: "town", label: "町の雪解け", text: texts.town.text, image: "/api/share/town.png", page: `${site}/public/share/town?via=sns` },
    { key: "recruit", label: "仲間を募集", text: texts.recruit.text, image: "/api/share/recruit.png", page: `${site}/public/share/recruit?via=sns` },
  ];
  if (me && meStats) {
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
        <>
          <StormBanner />
          <header className="flex items-center gap-3 px-4 pb-2 pt-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-camellia-soft ring-1 ring-camellia">
              <Icon name="connect" size={32} accent="var(--lamp)" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <h1 className="text-2xl font-bold">つなぐ</h1>
              <p className="whitespace-nowrap text-sm text-ink-soft">仲間を増やして、つながる</p>
            </div>
            <Link href={`/${q}`} className="btn btn-white min-h-11 px-3 text-sm">
              ホーム
            </Link>
          </header>
        </>
      }
      footer={<TabBar active="connect" q={q} />}
    >
      <ConnectScreen viewerId={me?.id} q={q} shareOptions={shareOptions} nakama={nakama} inviteLine={invites ? inviteResultLine(invites) : undefined} initialTab={initialTab} />
    </Screen>
  );
}

export default function ConnectPage({ searchParams }: { searchParams: Promise<{ as?: string; tab?: string }> }) {
  return (
    <>
      <Bgm track="morning" />
      <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-paper text-ink">読み込み中…</main>}>
        <ConnectContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
