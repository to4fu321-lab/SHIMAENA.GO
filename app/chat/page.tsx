import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { after, connection } from "next/server";
import { Suspense } from "react";
import ChatScreen from "@/components/ChatScreen";
import Mascot from "@/components/Mascot";
import { Screen } from "@/components/Pager";
import StormBanner from "@/components/StormBanner";
import TabBar from "@/components/TabBar";
import { PENDING_COOKIE, readPending } from "@/lib/auth/pending";
import PushSetup from "@/components/PushSetup";
import { hasClaudeKey } from "@/lib/claude/client";
import { localizeBubbles } from "@/lib/i18n/bubbles";
import { LANG_COOKIE, parseLang } from "@/lib/i18n/langs";
import { t } from "@/lib/i18n/ui";
import { captainVoiceName } from "@/lib/speech/credit";
import { inboxKeyOf } from "@/lib/inbox/key";
import { publicVapidKey } from "@/lib/push/keys";
import { repo } from "@/lib/repo";
import { listThread, markRead } from "@/lib/inbox/store";
import { syncIfDue } from "@/lib/feedback/ops";
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
 * ことば（spec v1.36）: cookie `lang` のことばで。決まった文字は辞書、隊長の吹き出しは Claude の訳（キャッシュつき）。
 */
async function Chat({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [roster, cookieStore] = await Promise.all([loadRoster(), cookies()]);
  const lang = parseLang(cookieStore.get(LANG_COOKIE)?.value);
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  // 家族の代わりに登録した人は参加者ではないが、「終わりました」などが届く（読むだけ。文は送れない）
  const pending = !me ? readPending(cookieStore.get(PENDING_COOKIE)?.value) : undefined;
  const family = pending && (await repo().listFamilyLinksByFamily(pending.lineUserId).catch(() => [])).length > 0 ? pending.lineUserId : undefined;
  const key = inboxKeyOf(me) ?? family;
  const q = demoAs ? `?as=${demoAs}` : "";
  const myTeam = onTeam(me) && me?.teamId ? teamTheme(me.teamId) : undefined;

  // 登録していない人の画面の題名（本物のトークの上段は ChatScreen が1行で描く）
  const header = (
    <header className="flex items-center gap-2 bg-ice-soft px-4 py-2" style={myTeam ? { background: myTeam.soft } : undefined}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card shadow-sm">
        <Mascot size={32} team={myTeam?.team.id} />
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <h1 className="text-xl font-bold">{t(lang, "title")}</h1>
        <p className="truncate text-sm text-ink-soft">{t(lang, "subtitle")}</p>
      </div>
    </header>
  );

  if (!key) {
    return (
      <Screen header={header} footer={<TabBar q={q} lang={lang} fab={false} />}>
        <section className="m-4 space-y-3 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-ink/10">
          <p className="text-lg font-bold">{t(lang, "notRegistered")}</p>
          <p className="text-base">{t(lang, "notRegisteredBody")}</p>
          <Link href="/start" className="btn btn-lamp btn-big w-full">
            {t(lang, "start")}
          </Link>
          <p className="text-sm text-ink-soft">
            {t(lang, "demo")}{" "}
            <Link href="/chat?as=h3" className="underline">
              {t(lang, "demoLink")}
            </Link>
          </p>
        </section>
      </Screen>
    );
  }

  // 報告箱（spec v1.33）: 直った報告があれば、開いたついでに GitHub を見て知らせを入れる（30分に1回。待たせない）
  if (me) after(() => syncIfDue());
  const items = await listThread(key);
  await markRead(key);
  const bubbles = await localizeBubbles(toBubbles(items, demoAs), lang);
  const viewer = me?.id ?? "";
  return (
    <Screen header={<StormBanner />} footer={<TabBar q={q} lang={lang} fab={false} />}>
      {/* 通知の案内（まだ許可していない人にだけ出る）。許可ずみなら上段に小さく「🔔 通知オン」。key={lang}: ことばを変えたら訳した流れで描き直す */}
      <ChatScreen
        key={lang}
        viewerId={viewer}
        initial={bubbles}
        teamId={myTeam?.team.id}
        readOnly={!me}
        headerBg={myTeam?.soft}
        extra={!demoAs ? <PushSetup viewerId={viewer} publicKey={publicVapidKey()} compact /> : undefined}
        lang={lang}
        canTranslate={hasClaudeKey()}
        voiceName={captainVoiceName()}
      />
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
