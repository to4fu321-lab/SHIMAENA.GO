import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import LiffBridge from "@/components/LiffBridge";
import { collection, nextReward, REWARDS } from "@/lib/cards/collection";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { repo } from "@/lib/repo";
import Icon from "@/components/Icon";
import CardBookCards from "@/components/CardBookCards";
import CardBookZukan from "@/components/CardBookZukan";
import Pager, { Screen } from "@/components/Pager";
import TabBar from "@/components/TabBar";
import { soloStatus } from "@/lib/solo/ops";
import { TEAMS } from "@/lib/teams";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "カード図鑑 ・ シマエナGO" };

async function CardsContent({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [roster, cookieStore, record] = await Promise.all([loadRoster(), cookies(), loadMorning()]);
  const viewerId = (as && isDemoViewer(as) ? as : undefined) ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = roster.participants.find((p) => p.id === viewerId);
  const cards = viewerId ? await repo().listCardsByRecipient(viewerId) : [];
  const team = TEAMS.find((t) => t.id === me?.teamId);
  const col = collection(cards);
  const reward = nextReward(cards.length);
  const title = record.weekly?.titles.find((t) => t.participantId === viewerId);
  const solo = me ? await soloStatus(me.id, new Date()) : undefined;
  const todayLogs = solo ? solo.recent.filter((l) => l.date === solo.today) : [];
  const q = as ? `?as=${as}` : "";

  const cardsTab = cards.length > 0 ? 3 : 0;

  return (
    <Screen
      header={
        <div className="space-y-1 px-4 pb-2 pt-3">
          <LiffBridge liffId={process.env.NEXT_PUBLIC_LIFF_ID} enabled={!as} />
          <div className="flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Icon name="card" size={34} accent="var(--camellia)" />
              カード図鑑
            </h1>
            <Link href={`/cards${q}`} className="btn btn-white min-h-11 px-3 text-sm">
              ‹ 活動カード
            </Link>
          </div>
          <p className="text-base leading-snug">
            {me ? (
              <>
                <b>{me.nickname}</b>さん{team && (
                  <>
                    （<span className="mr-1 inline-block size-3 rounded-full align-middle" style={{ background: team.color }} aria-hidden="true" />
                    <b>{team.name}</b>）
                  </>
                )}のカード <b>{cards.length}</b> 枚
              </>
            ) : (
              "まだ登録がありません"
            )}
          </p>
        </div>
      }
      footer={<TabBar active="card" q={q} />}
    >
      <Pager
        initial={cardsTab}
        tabs={[
          { key: "today", label: "今日" },
          { key: "zukan", label: "図鑑" },
          { key: "reward", label: "ごほうび" },
          { key: "cards", label: `カード ${cards.length}` },
        ]}
      >
        {/* 今日の活動をふりかえる（LINE のメニュー「活動カード」から来た人が、まず見るところ） */}
        <div className="space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="今日の活動">
          <h2 className="text-lg font-bold">今日の活動</h2>
          {solo ? (
            <>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-2xl bg-ice-soft px-2 py-2">
                  <p className="text-sm font-bold">今日の羽</p>
                  <p className="text-3xl font-bold tabular-nums">{solo.todayFeathers}</p>
                </div>
                <div className="rounded-2xl bg-ice-soft px-2 py-2">
                  <p className="text-sm font-bold">連続出動</p>
                  <p className="text-3xl font-bold tabular-nums">{solo.streak}日</p>
                </div>
                <div className="rounded-2xl bg-ice-soft px-2 py-2">
                  <p className="text-sm font-bold">カード</p>
                  <p className="text-3xl font-bold tabular-nums">{cards.length}枚</p>
                </div>
              </div>
              {todayLogs.length > 0 ? (
                <ul className="space-y-1 text-base">
                  {todayLogs.slice(0, 5).map((l) => (
                    <li key={l.id} className="flex items-baseline justify-between gap-2">
                      <span className="truncate">✓ {l.label}</span>
                      <b className="shrink-0 tabular-nums">+{l.feathers}羽</b>
                    </li>
                  ))}
                  {todayLogs.length > 5 && <li className="text-sm text-ink-soft">ほか {todayLogs.length - 5}件</li>}
                </ul>
              ) : (
                <>
                  <p className="text-base">今日の出動はまだありません。10分だけでも、町の力になります。</p>
                  <Link href={`/solo${q}`} className="btn btn-lamp text-lg">
                    雪かきGO！
                  </Link>
                </>
              )}
            </>
          ) : (
            <p className="text-base">LINE で登録すると、今日の羽や連続出動がここに出ます。</p>
          )}
        </div>

        {/* 図鑑: 5つのタッチとリボン。未入手は影で見せる（‹ › で2ページ） */}
        <CardBookZukan data={{ styles: col.styles, ribbons: col.ribbons, title: title?.title }} />

        {/* ご褒美（想定）: 町内会から。デモは架空 */}
        <div className="space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="ご褒美">
          <h2 className="text-lg font-bold">ご褒美（想定）</h2>
          {reward ? (
            <>
              <p className="text-base">
                あと <b className="text-camellia-deep">{reward.left}</b> 枚で <b>{reward.label}</b>
                <span className="text-sm text-ink-soft">（{reward.from}）</span>
              </p>
              <span className="block h-3 overflow-hidden rounded-full bg-ice-soft">
                <span className="block h-full rounded-full bg-ice" style={{ width: `${Math.min(100, (cards.length / reward.at) * 100)}%` }} />
              </span>
            </>
          ) : (
            <p className="text-base text-camellia-deep">ご褒美をぜんぶ受け取りました！</p>
          )}
          <ul className="text-base">
            {REWARDS.map((r) => (
              <li key={r.at}>
                {cards.length >= r.at ? "✓" : "・"} {r.at}枚で {r.label}
                <span className="text-sm text-ink-soft">（{r.from}）</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-soft">
            地元の銭湯やお店と町内会がつながる想定です。デモは架空で、実在の店ではありません。お金には換えません。
          </p>
        </div>

        <CardBookCards cards={cards} />
      </Pager>
    </Screen>
  );
}

export default function CardsPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <CardsContent searchParams={searchParams} />
    </Suspense>
  );
}
