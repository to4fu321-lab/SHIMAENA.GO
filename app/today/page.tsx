import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import AutoRefresh from "@/components/AutoRefresh";
import CheerButton from "@/components/CheerButton";
import Icon from "@/components/Icon";
import TabBar from "@/components/TabBar";
import Pager, { Screen } from "@/components/Pager";
import FriendShare from "@/components/FriendShare";
import SnsShare, { type ShareOption } from "@/components/SnsShare";
import { CHEER_COOKIE, cheeredToday } from "@/lib/public/cheer";
import { STYLE_NAME } from "@/lib/cards/rarity";
import { loadPublicStats } from "@/lib/public/load";
import { repo } from "@/lib/repo";
import { loadMeStats } from "@/lib/sns/me";
import { shareTextsFor } from "@/lib/sns/refresh";
import { mockShareText } from "@/lib/sns/text";
import { baseUrl } from "@/lib/url";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { progress, snowHp, teamTotals, viewBases } from "@/lib/morning/view";
import { teamTheme } from "@/lib/team-theme";
import { TEAMS } from "@/lib/teams";
import { soloStatus } from "@/lib/solo/ops";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "今朝のようす ・ シマエナGO" };

const STATUS_TEXT = {
  open: "人を待っています",
  short: "人手が足りません",
  assigned: "そろいました",
  in_progress: "作業中",
  done: "完了",
  no_answer: "返事がありません",
  none: "",
} as const;

/** くわしく: ホームに入りきらない「今日のあなた・今朝のようす・カード・SNS」。このページも1画面（タブで切りかえ） */
async function Details({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [record, roster, cookieStore] = await Promise.all([loadMorning(), loadRoster(), cookies()]);
  const m = record.morning;
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  const q = demoAs ? `?as=${demoAs}` : "";

  const hp = snowHp(m);
  const prog = progress(m);
  const totals = teamTotals(m);
  const max = Math.max(1, ...Object.values(totals));
  const planned = m.rollcall.status === "planned";

  const mySortie = me && m.sorties.find((s) => s.participantId === me.id && s.status === "going");
  const myMission = mySortie && m.missions.find((x) => x.id === mySortie.missionId);
  const myBase = myMission && roster.bases.find((b) => b.id === myMission.baseId);
  const myView = myMission && viewBases(m).get(myMission.baseId);
  const myTeam = TEAMS.find((t) => t.id === me?.teamId);
  const solo = me ? await soloStatus(me.id, new Date()) : undefined;
  // 今日のシマエナカード（本人の最新の1枚）と、SNS に投稿する下書き（数字は集計だけ）
  const latestCard = me ? (await repo().listCardsByRecipient(me.id).catch(() => []))[0] : undefined;
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

  // 1画面に収める（11/5 本人の指示「基本1画面」）: 縦に並べていたものをタブに分ける。いちばん大事な「今朝のようす」を最初に
  const youPanel = me && (
    <div key="you" className="flex min-h-0 flex-1 flex-col gap-2">
      <section className="space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="今日のあなた">
        <div className="flex items-baseline justify-between">
          <p className="eyebrow">今日のあなた</p>
          {myTeam && (
            <Link href={`/team${q}`} className="rounded-full px-2.5 py-0.5 text-sm font-bold" style={{ background: myTeam.color, color: teamTheme(myTeam.id).onColor }}>
              {myTeam.name}チーム ›
            </Link>
          )}
        </div>
        {solo && (
          <p className="flex flex-wrap gap-x-4 text-base">
            <span>
              羽ポイント <b className="text-2xl tabular-nums">{solo.todayFeathers}</b>（合計 {solo.totalFeathers}）
            </span>
            <span>
              連続出動 <b className="text-2xl tabular-nums">{solo.streak}</b> 日
            </span>
          </p>
        )}
        <Link href={`/solo${q}`} className="block rounded-2xl bg-ice-soft px-3 py-2 ring-1 ring-ice">
          <span className="block text-lg font-bold">ソロ出動へ →</span>
          <span className="block text-base">ひとりで10分から。自分の家の雪かき・道の危険の報告で、羽とチームの点が入ります。</span>
        </Link>
        {myBase && myView ? (
          <p className="text-base">
            担当は <b>拠点 {myBase.number}</b>（{STATUS_TEXT[myView.status]}）
          </p>
        ) : me.role === "helper" ? (
          <p className="text-base text-ink-soft">{solo?.todayFeathers === 0 ? "まだ今日の出動はありません。" : "今朝のチームの担当はありません。"}</p>
        ) : null}
      </section>

      {/* 今日のシマエナカード（本人の最新の1枚） */}
      <Link href={`/cards${q}`} className="flex min-h-14 items-center gap-3 rounded-3xl bg-camellia-soft p-3 ring-1 ring-camellia">
        {latestCard ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/cards/${latestCard.id}/front.svg`} alt="" className="aspect-[600/840] w-16 shrink-0 rounded-lg" />
            <span className="min-w-0">
              <span className="eyebrow block text-camellia-deep">今日のシマエナカード</span>
              <span className="block truncate text-base font-bold">{latestCard.designName}</span>
              <span className="block text-sm text-ink-soft">{STYLE_NAME[latestCard.style]} ・ 活動カードを開く</span>
            </span>
          </>
        ) : (
          <span className="min-w-0">
            <span className="eyebrow block text-camellia-deep">今日のシマエナカード</span>
            <span className="block text-base">まだありません。{solo?.nextCard.hint ?? "ミッションを1つ終えると最初のカード"}</span>
          </span>
        )}
      </Link>
    </div>
  );

  const tabs = [
    { key: "town", label: "ようす" },
    ...(me ? [{ key: "you", label: "あなた" }] : []),
    { key: "post", label: "投稿" },
    { key: "invite", label: "誘う" },
    { key: "more", label: "ほか" },
  ];

  return (
    <Screen
      header={
        <header className="flex items-center gap-2 bg-card px-2 py-2 shadow-sm">
          <AutoRefresh seconds={8} />
          <Link href={`/${q}`} className="btn min-h-12 px-3 text-base">
            ‹ ホーム
          </Link>
          <h1 className="text-xl font-bold">今朝のようす</h1>
        </header>
      }
      footer={<TabBar active="home" q={q} />}
    >
      <div className="h-2 shrink-0" />
      <Pager tabs={tabs}>
        {/* 今朝のようす: 雪のかさ・チームの得点・実況・応援 */}
        <section key="town" className="flex min-h-0 flex-1 flex-col gap-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="今朝のようす">
          <div className="rounded-2xl bg-ice-soft px-3 py-2">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate font-bold">今朝の雪{m.rollcall.snowName ? `『${m.rollcall.snowName}』` : ""}</span>
              <span className="shrink-0 tabular-nums">
                のこり {hp.current} / {hp.max}
              </span>
            </div>
            <span className="mt-1 block h-3 overflow-hidden rounded-full bg-white ring-1 ring-ink/10">
              <span className="block h-full rounded-full bg-ice" style={{ width: `${hp.max > 0 ? (hp.current / hp.max) * 100 : 100}%` }} />
            </span>
            <p className="mt-1 text-sm text-ink-soft">
              {!planned ? (m.rollcall.status === "open" ? "点呼中です（6:40 に作戦）" : "作戦はまだです") : prog.allDone ? <b className="text-ink">雪はすべてどけました。</b> : `あと ${prog.left} 軒で、今朝の雪はぜんぶどけられます。`}
            </p>
          </div>

          <ul className="space-y-1.5" aria-label="チームの得点">
            {TEAMS.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-sm">
                <span className="w-32 shrink-0 font-bold">
                  <span className="mr-1 inline-block size-3 rounded-full align-middle" style={{ background: t.color }} aria-hidden="true" />
                  {t.name}
                </span>
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-ice-soft">
                  <span className="block h-full rounded-full" style={{ width: `${(totals[t.id] / max) * 100}%`, background: t.color }} />
                </span>
                <span className="w-12 text-right font-bold tabular-nums">{totals[t.id]}点</span>
              </li>
            ))}
          </ul>

          {record.recap && (
            <div className="min-h-0 rounded-2xl bg-warm px-3 py-2">
              <p className="eyebrow">今朝の実況（シマエナ隊長）</p>
              <p className="text-base">{record.recap.text}</p>
            </div>
          )}

          <div className="mt-auto">
            <CheerButton compact count={stats.cheers} already={cheeredToday(cookieStore.get(CHEER_COOKIE)?.value, stats.today)} />
          </div>
        </section>
        {youPanel}
        <SnsShare key="post" options={shareOptions} fill />
        <div key="invite" className="flex min-h-0 flex-1 flex-col gap-2">
          <FriendShare />
        </div>
        <div key="more" className="flex min-h-0 flex-1 flex-col gap-2">
          <nav className="grid gap-3" aria-label="そのほか">
            <Link href={`/settings${q}`} className="btn btn-white gap-2 text-lg">
              <Icon name="settings" size={28} accent="var(--ice)" />
              設定（登録の確認・やり直し）
            </Link>
            <Link href="/public/town" className="btn text-base text-ink underline">
              町の雪解け（公開ページ）
            </Link>
            <Link href="/admin" className="btn text-sm text-ink-soft underline">
              デモ操作（審査・撮影用）
            </Link>
          </nav>
        </div>
      </Pager>
    </Screen>
  );
}

export default function TodayPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-paper text-ink">読み込み中…</main>}>
      <Details searchParams={searchParams} />
    </Suspense>
  );
}
