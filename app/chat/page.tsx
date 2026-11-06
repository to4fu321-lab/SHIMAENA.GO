import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import ChatScreen from "@/components/ChatScreen";
import Mascot from "@/components/Mascot";
import { Screen } from "@/components/Pager";
import StormBanner from "@/components/StormBanner";
import TabBar from "@/components/TabBar";
import { PENDING_COOKIE, readPending } from "@/lib/auth/pending";
import PushSetup from "@/components/PushSetup";
import { inboxKeyOf } from "@/lib/inbox/key";
import { publicVapidKey } from "@/lib/push/keys";
import { repo } from "@/lib/repo";
import { listThread, markRead } from "@/lib/inbox/store";
import { toBubbles } from "@/lib/inbox/view";
import { onTeam } from "@/lib/member";
import { loadRoster } from "@/lib/morning/roster";
import { teamTheme } from "@/lib/team-theme";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";
import Bgm from "@/components/Bgm";

export const metadata: Metadata = { title: "隊長トーク ・ シマエナGO" };

/**
 * 隊長トーク（spec v1.17）: 届くもの（予告・点呼・作戦・完了・ありがとう・なかま…）と、本人の文・ボタンの答えが1つの流れで並ぶ。
 * 文面とボタンは今までの LINE の文面のまま。ページは1画面（流れの中だけがスクロールする。LINE と同じ）。
 */
async function Chat({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [roster, cookieStore] = await Promise.all([loadRoster(), cookies()]);
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  // 家族の代わりに登録した人は参加者ではないが、「終わりました」などが届く（読むだけ。文は送れない）
  const pending = !me ? readPending(cookieStore.get(PENDING_COOKIE)?.value) : undefined;
  const family = pending && (await repo().listFamilyLinksByFamily(pending.lineUserId).catch(() => [])).length > 0 ? pending.lineUserId : undefined;
  const key = inboxKeyOf(me) ?? family;
  const q = demoAs ? `?as=${demoAs}` : "";
  const myTeam = onTeam(me) && me?.teamId ? teamTheme(me.teamId) : undefined;

  const header = (
    <header className="flex items-center gap-2 bg-ice-soft px-4 py-2" style={myTeam ? { background: myTeam.soft } : undefined}>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-card shadow-sm">
        <Mascot size={36} team={myTeam?.team.id} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <h1 className="text-xl font-bold">隊長トーク</h1>
        <p className="truncate text-sm text-ink-soft">雪の朝のお知らせと、なんでも相談</p>
      </div>
    </header>
  );

  if (!key) {
    return (
      <Screen header={header} footer={<TabBar active="chat" q={q} />}>
        <section className="m-4 space-y-3 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-ink/10">
          <p className="text-lg font-bold">隊長トークは、登録した人の画面です。</p>
          <p className="text-base">雪の朝のお知らせや、来てくれる人のお知らせがここに届きます。文で相談もできます。</p>
          <Link href="/start" className="btn btn-lamp btn-big w-full">
            はじめる（30秒で登録）
          </Link>
          <p className="text-sm text-ink-soft">
            デモ: <Link href="/chat?as=h3" className="underline">架空の手伝う側として開く</Link>
          </p>
        </section>
      </Screen>
    );
  }

  const items = await listThread(key);
  await markRead(key);
  const bubbles = toBubbles(items, demoAs);
  const viewer = me?.id ?? "";
  return (
    <Screen header={<><StormBanner />{header}</>} footer={<TabBar active="chat" q={q} />}>
      {!demoAs && (
        <div className="shrink-0 px-3 pt-2">
          <PushSetup viewerId={viewer} publicKey={publicVapidKey()} />
        </div>
      )}
      <ChatScreen viewerId={viewer} initial={bubbles} teamId={myTeam?.team.id} readOnly={!me} />
    </Screen>
  );
}

export default function ChatPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <>
      <Bgm track="morning" level={0.5} />
      <Suspense fallback={<div className="min-h-dvh bg-paper" />}>
        <Chat searchParams={searchParams} />
      </Suspense>
    </>
  );
}
