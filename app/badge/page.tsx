// 雪かき中の印（spec v1.12）。行き先カードの「雪かき中の印（玄関で見せる）」から開く。
// 持ち物（腕章など）は使わない。毎週変わるチームの色と、毎日変わる合言葉はこの画面で見せる。名前は出さない。
// 本人（ログインした人・デモの架空の人）だけが見られる。夜は合言葉を出さない。
// 1画面（11/5 本人の指示）: 小さいスマホでもスクロールしないよう、シマエナガの輪だけを画面の高さに合わせて縮める。
import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import LoginButton from "@/components/LoginButton";
import LiveClock from "@/components/LiveClock";
import Mascot from "@/components/Mascot";
import { passwordOf } from "@/lib/badge";
import { demoEnabled } from "@/lib/env";
import { jstDate } from "@/lib/jst";
import { onTeam } from "@/lib/member";
import { loadRoster } from "@/lib/morning/roster";
import { isNight, NIGHT_TEXT } from "@/lib/night";
import { teamTerm, teamTheme } from "@/lib/team-theme";
import { TOWN } from "@/lib/town";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";
import Bgm from "@/components/Bgm";

export const metadata: Metadata = { title: "雪かき中の印 ・ シマエナGO" };

const TODAY_LABEL = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "numeric", day: "numeric", weekday: "short" });

async function BadgeView({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [roster, cookieStore] = await Promise.all([loadRoster(), cookies()]);
  const demoAs = as && isDemoViewer(as) && demoEnabled() ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  const q = demoAs ? `?as=${demoAs}` : "";
  const theme = me && onTeam(me) && me.teamId ? teamTheme(me.teamId) : undefined;
  const now = new Date();
  const night = isNight(now);
  const password = theme && !night ? passwordOf(jstDate(now)) : undefined;

  if (!theme) {
    return (
      <main className="mx-auto min-h-dvh max-w-md bg-paper px-4 pt-8 text-center text-ink">
        <Mascot className="mx-auto h-28 w-auto" />
        <h1 className="mt-2 text-2xl font-bold">雪かき中の印</h1>
        <p className="mt-3 text-lg">
          {me ? "チームに入っている人だけに出ます。" : "ログインすると、あなたの印が出ます。"}
        </p>
        {!me && <LoginButton next="/badge" className="mt-4 text-left" />}
        <Link href={`/${q}`} className="btn btn-lamp mt-6 text-lg">
          ホームへ
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col overflow-hidden bg-paper text-ink">

      {/* エリア共通の印（毎週同じ） */}
      <section className="shrink-0 bg-ink px-4 py-2 text-center text-white" aria-label="エリア共通の印">
        <p className="text-sm font-bold tracking-[0.2em]">{TOWN.name.replace("（架空）", "")} 公認</p>
        <p className="text-2xl font-bold">シマエナGO 雪かき中</p>
      </section>

      {/* 今週のチームの色（毎週かわる） */}
      <section
        className="relative flex min-h-0 flex-1 flex-col items-center justify-center px-4 py-3 text-center"
        style={{ background: theme.team.color, color: theme.onColor }}
        aria-label="今週のチーム"
      >
        <div className="relative grid aspect-square h-[min(11rem,24dvh)] min-h-0 shrink place-items-center">
          <span
            className="badge-ring absolute inset-0 rounded-full border-[6px] border-dashed"
            style={{ borderColor: theme.onColor }}
            aria-hidden="true"
          />
          <Mascot team={theme.team.id} mood="happy" size={130} className="h-[74%] w-auto" />
        </div>
        <p className="mt-2 text-xl font-bold">
          {theme.team.colorName}の{theme.team.name}チーム
        </p>
        <p className="text-base font-bold">{teamTerm(jstDate(now)).label}</p>

        {night ? (
          <div className="mt-3 w-full rounded-3xl bg-white px-4 py-3 text-ink shadow-md">
            <p className="text-lg font-bold">{NIGHT_TEXT.short}</p>
            <p className="mt-1 text-base">{NIGHT_TEXT.why}</p>
          </div>
        ) : (
          <div className="mt-3 w-full rounded-3xl bg-white px-4 py-3 text-ink shadow-md">
            <p className="text-base font-bold">今日の合言葉（{TODAY_LABEL.format(now)}）</p>
            <p className="mt-1 text-4xl font-bold" style={{ color: theme.deep }}>
              {password ?? "（準備中）"}
            </p>
            <LiveClock className="mt-1 text-3xl font-bold" />
          </div>
        )}
      </section>

      {/* 玄関での約束（決まった文） */}
      <section className="shrink-0 space-y-0.5 bg-card px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 text-lg leading-snug" aria-label="玄関での約束">
        <p>📱 玄関では、この画面を見せます。</p>
        <p>🚪 玄関は開けてもらわなくて大丈夫です。</p>
        <p>💴 お金や物は受け取りません。家には上がりません。</p>
        <Link href={`/map${q}`} className="btn btn-white mt-2 w-full text-lg">
          町の地図へ
        </Link>
      </section>
    </main>
  );
}

export default function BadgePage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <>
      <Bgm track="mission" />
      <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
        <BadgeView searchParams={searchParams} />
      </Suspense>
    </>
  );
}
