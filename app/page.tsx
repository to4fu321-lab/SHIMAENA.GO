import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import AutoRefresh from "@/components/AutoRefresh";
import CheerButton from "@/components/CheerButton";
import Icon from "@/components/Icon";
import MenuTiles from "@/components/MenuTiles";
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
import { progress, snowHp, snowTotal, teamTotals, viewBases } from "@/lib/morning/view";
import { listShort } from "@/lib/morning/watch";
import { TEAMS } from "@/lib/teams";
import { soloStatus } from "@/lib/solo/ops";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "シマエナGO ・ 5分の雪かきで、町が変わる" };

const STATUS_TEXT = {
  open: "人を待っています",
  short: "人手が足りません",
  assigned: "そろいました",
  in_progress: "作業中",
  done: "完了",
  no_answer: "返事がありません",
  none: "",
} as const;

/** 今日の数字（大きく・はっきり） */
function BigNum({ label, value, unit, note }: { label: string; value: number | string; unit: string; note?: string }) {
  return (
    <div className="rounded-2xl bg-ice-soft px-2 py-3 text-center">
      <p className="text-sm font-bold leading-tight">{label}</p>
      <p className="mt-1 leading-none">
        <span className="text-4xl font-bold tabular-nums">{value}</span>
        <span className="ml-0.5 text-lg font-bold">{unit}</span>
      </p>
      {note && <p className="mt-1 text-xs text-ink-soft">{note}</p>}
    </div>
  );
}

/** 家の灯り（完了した家の数だけ窓が明るくなる） */
function Houses({ total, done }: { total: number; done: number }) {
  if (total === 0) return null;
  const n = Math.min(total, 12);
  const lit = Math.round((done / total) * n);
  return (
    <ul className="flex flex-wrap justify-center gap-1.5" aria-label={`${total}軒のうち ${done}軒 完了`}>
      {Array.from({ length: n }, (_, i) => (
        <li key={i}>
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path d="M3 12 L12 4 L21 12 V21 H3 Z" fill={i < lit ? "#f5eee5" : "#ffffff"} stroke="#29445c" strokeWidth="1.6" strokeLinejoin="round" />
            <rect x="9.5" y="13" width="5" height="5" rx="1" fill={i < lit ? "#d9825b" : "#e3eef3"} />
          </svg>
        </li>
      ))}
    </ul>
  );
}

/** ホーム = 今朝の出撃画面（spec v1.1 10.6）。初めて見た人でも、今日なにが起きていて、自分は何をすればいいかが一目で分かるように */
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
  const canHelpHouse = planned && me?.role === "helper" && Boolean(me.teamId);
  const fiveHref = canHelpHouse ? `/map${q}` : `/solo?pick=5${demoAs ? `&as=${demoAs}` : ""}`;
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

  // 次に手伝ってほしい場所: 人手が足りない家 → なければ自分の担当 → なければソロの5分
  const next = shorts[0];

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 bg-paper px-4 pb-8 pt-4 text-ink">
      <AutoRefresh seconds={8} />
      <header className="snowfield -mx-4 -mt-4 px-4 pb-5 pt-5 text-center">
        <p className="eyebrow">Built with Claude: Japan 2026</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight">
          シマエナ<span className="text-camellia-deep">GO</span>
        </h1>
        <p className="mt-2 text-2xl font-bold leading-snug">
          5分の雪かきで、
          <br />
          町が変わる。
        </p>
        <p className="mt-1 text-base text-ink-soft">寒い冬は、くっついて乗り切る。</p>
      </header>

      {/* 今日の町（いちばん大きく見せる数字） */}
      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="今日の町">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-bold">
            {month}月{day}日の朝
          </h2>
          <p className="text-sm text-ink-soft">予報 {m.rollcall.forecastCm}cm</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <BigNum label="救える家" value={prog.total} unit="軒" note={prog.total > 0 && !prog.allDone ? `のこり ${prog.left}軒` : prog.allDone && prog.total > 0 ? "すべて完了" : "作戦はまだ"} />
          <BigNum label="参加した人" value={stats.todayPeople} unit="人" note="チーム＋ソロ" />
          <BigNum label="雪かき達成" value={prog.done} unit="軒" note={snow.kg > 0 ? `雪 ${snow.label}` : undefined} />
        </div>
        <Houses total={prog.total} done={prog.done} />
        {prog.total > 0 && (
          <p className="text-center text-sm">
            {prog.allDone ? (
              <b>
                {month}月{day}日 {prog.defeatedAt ? `${prog.defeatedAt} に ` : ""}すべての家の灯りがともりました。
              </b>
            ) : (
              <>
                灯りがともった家 <b className="text-lg tabular-nums">{prog.done}</b> / {prog.total} 軒
                {snow.kg > 0 && <span className="text-ink-soft">（どけた雪は {snow.comparison}）</span>}
              </>
            )}
          </p>
        )}
      </section>

      {/* 次に手伝ってほしい場所 */}
      <section className="space-y-3 rounded-3xl bg-warm p-4 ring-1 ring-ink/10" aria-label="次に手伝ってほしい場所">
        <p className="eyebrow">次に手伝ってほしい場所</p>
        {next ? (
          <>
            <p className="text-2xl font-bold leading-tight">
              拠点 {next.baseNumber}
              <span className="ml-2 text-lg text-alert">あと{next.missing}人</span>
            </p>
            <p className="text-base">
              いま {next.going}人 / 必要 {next.required}人。5分でできる仕事: <b>{next.tasks.join("・")}</b>
            </p>
            {shorts.length > 1 && <p className="text-sm text-ink-soft">ほかにも人手が足りない家が {shorts.length - 1} 軒あります。</p>}
            <Link href={fiveHref} className="btn btn-lamp btn-big">
              5分だけ助けに行く
            </Link>
          </>
        ) : myBase && myView ? (
          <>
            <p className="text-2xl font-bold leading-tight">あなたの担当: 拠点 {myBase.number}</p>
            <p className="text-base">
              {STATUS_TEXT[myView.status]}。いま {myView.goingPeople}人 / 必要 {myView.requiredPeople}人。
            </p>
            <Link href={`/map${q}`} className="btn btn-lamp btn-big">
              町の地図で場所を見る
            </Link>
          </>
        ) : (
          <>
            <p className="text-xl font-bold leading-tight">{planned ? "いまは人手が足りています" : "今朝は雪かきの作戦がありません"}</p>
            <p className="text-base">仲間がいなくても、1人の5分で町を変えられます。見回りや自分の家の雪かきから。</p>
            <Link href={fiveHref} className="btn btn-lamp btn-big">
              5分だけ出動する
            </Link>
          </>
        )}
      </section>

      {/* 今日の自分 */}
      {me && (
        <section className="space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="今日のあなた">
          <div className="flex items-baseline justify-between">
            <p className="eyebrow">今日のあなた</p>
            {myTeam && (
              <p className="text-sm font-bold">
                <span className="mr-1 inline-block size-3 rounded-full align-middle" style={{ background: myTeam.color }} aria-hidden="true" />
                {myTeam.name}チーム
              </p>
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
          {myBase && myView ? (
            <p className="text-base">
              担当は <b>拠点 {myBase.number}</b>（{STATUS_TEXT[myView.status]}）
            </p>
          ) : me.role === "helper" ? (
            <p className="text-base text-ink-soft">{solo?.todayFeathers === 0 ? "まだ今日の出動はありません。" : "今朝のチームの担当はありません。"}</p>
          ) : null}
        </section>
      )}

      {/* LINE のメニューと同じ4つ（名前・色・アイコンをそろえる） */}
      <MenuTiles hrefs={{ go: `/solo${q}`, map: `/map${q}`, card: `/cards${q}`, guide: "/rules" }} />

      {/* 今朝のようす: 雪のかさ・チームの得点・実況・応援 */}
      <section className="space-y-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="今朝のようす">
        <p className="eyebrow">今朝のようす</p>
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
          <div className="rounded-2xl bg-warm px-3 py-2">
            <p className="eyebrow">今朝の実況（エナガ隊長）</p>
            <p className="text-base">{record.recap.text}</p>
          </div>
        )}

        <CheerButton compact count={stats.cheers} already={cheeredToday(cookieStore.get(CHEER_COOKIE)?.value, stats.today)} />
      </section>

      {/* 今日のシマエナカード（本人の最新の1枚） */}
      {me && (
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
      )}

      <SnsShare options={shareOptions} />

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
