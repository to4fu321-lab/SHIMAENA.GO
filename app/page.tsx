import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import AutoRefresh from "@/components/AutoRefresh";
import SnsShare, { type ShareOption } from "@/components/SnsShare";
import { STYLE_NAME } from "@/lib/cards/rarity";
import { loadPublicStats } from "@/lib/public/load";
import { repo } from "@/lib/repo";
import { loadMeStats } from "@/lib/sns/me";
import { mockShareText } from "@/lib/sns/text";
import { baseUrl } from "@/lib/url";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { progress, snowHp, snowTotal, teamTotals, viewBases } from "@/lib/morning/view";
import { listShort } from "@/lib/morning/watch";
import { TEAMS } from "@/lib/teams";
import { soloStatus } from "@/lib/solo/ops";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "シマエナGO ・ 今朝の出撃" };

const STATUS_TEXT = {
  open: "人を待っています",
  short: "人手が足りません",
  assigned: "そろいました",
  in_progress: "作業中",
  done: "完了",
  no_answer: "返事がありません",
  none: "",
} as const;

/** ホーム = 今朝の出撃画面（spec v1.1 10.6）。初めて見た人でも、今朝なにが起きているかが一目で分かるように */
async function Today({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
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
  const snow = snowTotal(m);
  const totals = teamTotals(m);
  const max = Math.max(1, ...Object.values(totals));
  const movers = new Set(m.sorties.map((s) => s.participantId)).size;
  const shorts = listShort(record, roster);
  const planned = m.rollcall.status === "planned";
  const [, month, day] = m.rollcall.date.split("-").map(Number);

  const mySortie = me && m.sorties.find((s) => s.participantId === me.id && s.status === "going");
  const myMission = mySortie && m.missions.find((x) => x.id === mySortie.missionId);
  const myBase = myMission && roster.bases.find((b) => b.id === myMission.baseId);
  const myView = myMission && viewBases(m).get(myMission.baseId);
  const myTeam = TEAMS.find((t) => t.id === me?.teamId);
  const solo = me ? await soloStatus(me.id, new Date()) : undefined;
  // 「5分だけ出動」: 作戦中で手伝う側（チームあり）なら地図の5分だけ参加、そうでなければソロの5分ミッション
  const fiveHref = planned && me?.role === "helper" && me.teamId ? `/map${q}` : `/solo?pick=5${demoAs ? `&as=${demoAs}` : ""}`;
  // 今日のシマエナカード（本人の最新の1枚）と、SNS に投稿する下書き（数字は集計だけ）
  const latestCard = me ? (await repo().listCardsByRecipient(me.id).catch(() => []))[0] : undefined;
  const stats = await loadPublicStats();
  const site = baseUrl();
  const shareOptions: ShareOption[] = [
    { key: "today", label: "今日の出動", text: mockShareText("today", stats), image: "/api/share/today.png", page: `${site}/public/share/today?via=sns` },
    { key: "town", label: "町の雪解け", text: mockShareText("town", stats), image: "/api/share/town.png", page: `${site}/public/share/town?via=sns` },
    { key: "recruit", label: "仲間を募集", text: mockShareText("recruit", stats), image: "/api/share/recruit.png", page: `${site}/public/share/recruit?via=sns` },
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
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-paper px-4 pb-6 pt-5 text-ink">
      <AutoRefresh seconds={8} />
      <header className="text-center">
        <p className="text-xs font-bold tracking-widest text-neon">Built with Claude: Japan 2026</p>
        <h1 className="text-3xl font-bold">
          シマエナ<span className="text-neon">GO</span>
        </h1>
        <p className="text-base text-ink/80">寒い冬は、くっついて乗り切る。</p>
      </header>

      {/* 今朝の状況 */}
      <section className="space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/10" aria-label="今朝の出撃">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">
            {month}月{day}日の朝
          </h2>
          <p className="text-sm text-ink/70">予報 {m.rollcall.forecastCm}cm</p>
        </div>

        <div className={`rounded-2xl px-3 py-2 ring-1 ${prog.allDone ? "bg-[#fff0f6] ring-neon/40" : "bg-paper ring-ink/10"}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-bold">今朝の相手{m.rollcall.snowName ? `『${m.rollcall.snowName}』` : ""}</span>
            <span className="shrink-0 tabular-nums">
              HP {hp.current} / {hp.max}
            </span>
          </div>
          <span className="mt-1 block h-3 overflow-hidden rounded-full bg-ink/10">
            <span className="block h-full rounded-full bg-snow" style={{ width: `${hp.max > 0 ? (hp.current / hp.max) * 100 : 100}%` }} />
          </span>
          <p className="mt-1 text-sm text-ink/70">
            {!planned ? (
              m.rollcall.status === "open" ? "点呼中です（6:40 に作戦）" : "作戦はまだです"
            ) : prog.allDone ? (
              <b className="text-neon">討伐{prog.defeatedAt ? ` ${prog.defeatedAt}` : ""}！ {prog.total}軒すべて完了</b>
            ) : (
              <>
                {prog.done} / {prog.total} 軒 ・ あと {prog.left} 軒 ・ 動いた人 {movers} 人
              </>
            )}
          </p>
          {snow.kg > 0 && (
            <p className="mt-1 text-sm">
              町内みんなでどけた雪 <b className="text-lg text-ink">{snow.label}</b>
              <span className="text-ink/70">（{snow.comparison}・{snow.houses}軒分）</span>
            </p>
          )}
        </div>

        <ul className="space-y-1" aria-label="チームの得点">
          {TEAMS.map((t) => (
            <li key={t.id} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 font-bold" style={{ color: t.color }}>
                {t.name}
              </span>
              <span className="h-3 flex-1 overflow-hidden rounded-full bg-ink/10">
                <span className="block h-full rounded-full" style={{ width: `${(totals[t.id] / max) * 100}%`, background: t.color }} />
              </span>
              <span className="w-10 text-right tabular-nums">{totals[t.id]}</span>
            </li>
          ))}
        </ul>

        {record.recap && (
          <div className="rounded-2xl bg-paper px-3 py-2 ring-1 ring-ink/10">
            <p className="text-xs font-bold tracking-widest text-neon">今朝の実況</p>
            <p className="text-base">{record.recap.text}</p>
          </div>
        )}

        {me && (
          <p className="text-base">
            {myTeam ? (
              <>
                あなたは <b style={{ color: myTeam.color }}>{myTeam.name}</b>。
              </>
            ) : null}
            {myBase && myView ? (
              <>
                担当は <b>拠点 {myBase.number}</b>（{STATUS_TEXT[myView.status]}）
              </>
            ) : me.role === "helper" ? (
              "今朝の担当はまだありません。"
            ) : null}
          </p>
        )}
      </section>

      {me && solo && (
        <Link href={`/solo${q}`} className="block rounded-2xl bg-[#fff0f6] px-3 py-2 ring-1 ring-neon/40">
          <span className="text-xs font-bold tracking-widest text-neon">今日の自分</span>
          <span className="block text-base">
            羽 <b className="text-lg tabular-nums">{solo.todayFeathers}</b>（合計 {solo.totalFeathers}）・連続出動 <b className="tabular-nums">{solo.streak}</b> 日
            <span className="text-ink/70">{solo.todayFeathers === 0 ? " ・ まだ今日の出動なし →" : " →"}</span>
          </span>
        </Link>
      )}

      <nav className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Link href={`/solo${q}`} className="rounded-2xl bg-neon py-4 text-center text-xl font-bold text-white">
            ソロ出動
          </Link>
          <Link href={fiveHref} className="rounded-2xl bg-neon/85 py-4 text-center text-lg font-bold leading-tight text-white">
            5分だけ
            <br />
            出動
          </Link>
        </div>
        <Link href={`/map${q}`} className="rounded-2xl bg-ink py-4 text-center text-xl font-bold text-white">
          チーム出撃（地図）
        </Link>
      </nav>

      {shorts.length > 0 && (
        <Link href={`/map${q}`} className="block rounded-2xl bg-[#fff0f3] px-3 py-2 ring-1 ring-alert/40">
          <b className="text-alert">{shorts[0].missing === 1 ? "あと1人で救える家" : "人手が足りない家"}</b>
          <span className="text-ink/80">
            {" "}
            が {shorts.length} 軒。5分でも助かります →
          </span>
        </Link>
      )}

      {/* 今日のシマエナカード（本人の最新の1枚） */}
      {me && (
        <Link href={`/cards${q}`} className="flex items-center gap-3 rounded-3xl bg-white p-3 shadow-sm ring-1 ring-ink/10">
          {latestCard ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/cards/${latestCard.id}/front.svg`} alt="" className="aspect-[600/840] w-16 shrink-0 rounded-lg" />
              <span className="min-w-0">
                <span className="block text-xs font-bold tracking-widest text-neon">今日のシマエナカード</span>
                <span className="block truncate text-base font-bold">{latestCard.designName}</span>
                <span className="block text-sm text-ink/70">{STYLE_NAME[latestCard.style]} ・ カード帳へ →</span>
              </span>
            </>
          ) : (
            <span className="min-w-0">
              <span className="block text-xs font-bold tracking-widest text-neon">今日のシマエナカード</span>
              <span className="block text-base">まだありません。{solo?.nextCard.hint ?? "ミッションを1つ終えると最初のカード"}</span>
            </span>
          )}
        </Link>
      )}

      <SnsShare options={shareOptions} />

      <nav className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Link href="/rules" className="rounded-2xl bg-white py-4 text-center text-lg font-bold text-ink ring-2 ring-ink/15">
            あそびかた
          </Link>
          <Link href={`/cards${q}`} className="rounded-2xl bg-white py-4 text-center text-lg font-bold text-ink ring-2 ring-ink/15">
            カード帳
          </Link>
        </div>
        <Link href="/public/town" className="py-1 text-center text-base text-ink underline">
          町の雪解け（公開ページ）
        </Link>
        <Link href="/admin" className="py-2 text-center text-sm text-ink/70 underline">
          デモ操作（審査・撮影用）
        </Link>
      </nav>
    </main>
  );
}

export default function Home({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-paper text-ink">読み込み中…</main>}>
      <Today searchParams={searchParams} />
    </Suspense>
  );
}
