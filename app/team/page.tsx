// 今週のチーム（T47）。隊長トークのチーム発表の「チームを見る」から開く。
// 1週間（月曜〜日曜）のチームを、チームの色・チーム色のマフラーのシマエナガ・期間で大きく見せる。名前は出さない（人数だけ）。
// 1画面（11/5 本人の指示）: タブ「あなたのチーム／3チーム／しくみ」を横スワイプ。縦にはスクロールしない。
import type { Metadata } from "next";
import { onTeam } from "@/lib/member";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import Mascot from "@/components/Mascot";
import Pager, { Screen } from "@/components/Pager";
import { jstDate } from "@/lib/jst";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { teamTotals } from "@/lib/morning/view";
import { teamTerm, teamTheme } from "@/lib/team-theme";
import { TEAMS } from "@/lib/teams";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "今週のチーム ・ シマエナGO" };

const CONFETTI_AT = [4, 13, 22, 31, 40, 49, 58, 67, 76, 85, 94];

async function TeamView({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [roster, record, cookieStore] = await Promise.all([loadRoster(), loadMorning(), cookies()]);
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  const q = demoAs ? `?as=${demoAs}` : "";
  const term = teamTerm(jstDate());
  const mine = me?.teamId ? teamTheme(me.teamId) : undefined;
  const totals = teamTotals(record.morning);
  const members = (id: string) => roster.participants.filter((p) => onTeam(p) && p.teamId === id).length;

  return (
    <Screen
      footer={
        <nav className="grid grid-cols-2 gap-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
          <Link href={`/map${q}`} className="btn btn-white text-lg">
            町の地図
          </Link>
          <Link href={`/${q}`} className="btn btn-lamp text-lg">
            ホームへ
          </Link>
        </nav>
      }
    >
      <div className="pt-3" />
      <Pager tabs={[{ key: "mine", label: mine ? "あなた" : "今週" }, { key: "three", label: "3チーム" }, { key: "how", label: "しくみ" }]}>
      {/* 発表（チームの色いっぱいに） */}
      {mine ? (
        <section
          className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[2rem] px-4 py-3 text-center shadow-md"
          style={{ background: mine.team.color, color: mine.onColor }}
          aria-label="あなたのチーム"
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            {CONFETTI_AT.map((x, i) => (
              <span
                key={x}
                className="confetti"
                style={{ left: `${x}%`, background: ["#ffffff", mine.light, "#F3C48A", "#C8A7B8"][i % 4], animationDelay: `${(i % 5) * 0.6}s` }}
              />
            ))}
          </div>
          <p className="relative mx-auto inline-block rounded-full bg-white px-5 py-1 text-lg font-bold shadow-sm" style={{ color: mine.deep }}>
            🎉 今週のあなたのチーム 🎉
          </p>
          <Mascot team={mine.team.id} mood="happy" className="team-reveal relative mx-auto mt-2 h-auto min-h-0 w-auto max-h-40 flex-1 drop-shadow-lg" />
          <p className="relative text-xl font-bold">あなたは</p>
          <h1 className={`team-name relative font-bold leading-tight ${mine.team.name.length > 5 ? "whitespace-nowrap text-[2.6rem]" : "text-6xl tracking-wide"}`}>{mine.team.name}</h1>
          <p className="relative text-base font-bold tracking-[0.3em]">TEAM {mine.team.nameEn}</p>
          <p className="relative mx-auto mt-3 inline-block rounded-full bg-ink px-5 py-1.5 text-lg font-bold text-white">{term.label}</p>
          <p className="relative mt-1 text-base font-bold">日曜の夜 9時に、次の週のチームを発表</p>
        </section>
      ) : (
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-[2rem] bg-ice-soft px-4 py-4 text-center" aria-label="今週のチーム">
          <Mascot className="mx-auto h-auto max-h-28 min-h-0 w-auto flex-1" />
          <h1 className="text-3xl font-bold">今週のチーム</h1>
          <p className="mt-1 text-lg font-bold">{term.label}</p>
          <p className="mt-1 text-base">
            {me ? "お願いする側の人はチームに入りません。3チームが家の雪をどけに来ます。" : "「手伝う」で登録すると、3チームのどれかに入ります。"}
          </p>
        </section>
      )}

      {/* 3チーム */}
      <section aria-label="3つのチーム" className="flex min-h-0 flex-1 flex-col justify-center">
        <h2 className="mb-3 text-lg font-bold">今週の3チーム</h2>
        <ul className="grid grid-cols-3 gap-2">
          {TEAMS.map((t) => {
            const th = teamTheme(t.id);
            const isMine = mine?.team.id === t.id;
            return (
              <li
                key={t.id}
                className={`relative rounded-2xl bg-card px-1 pb-2 pt-1 text-center shadow-sm ${isMine ? "ring-4" : "ring-1 ring-ink/10"}`}
                style={isMine ? { ["--tw-ring-color" as string]: t.color } : undefined}
              >
                {isMine && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-2 text-sm font-bold" style={{ background: t.color, color: th.onColor }}>
                    あなた
                  </span>
                )}
                <Mascot team={t.id} size={80} className="mx-auto" />
                <p className="text-base font-bold leading-tight" style={{ color: th.deep }}>
                  {t.name}
                </p>
                <p className="text-sm">{t.colorName}・{members(t.id)}人</p>
                <p className="text-sm font-bold tabular-nums">今朝 {totals[t.id] ?? 0}点</p>
              </li>
            );
          })}
        </ul>
      </section>

      {/* 1週間のチームって？ */}
      <section className="space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="1週間のチームって？">
        <h2 className="text-lg font-bold">1週間のチームって？</h2>
        <ol className="space-y-2 text-base">
          <li className="flex gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">1</span>
            <span>
              <b>月曜〜日曜の1週間</b>、同じ色のチームで雪の朝に出動します。
            </span>
          </li>
          <li className="flex gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">2</span>
            <span>
              <b>日曜の夜 9時</b>に組み直して、隊長トークに「チーム発表」が届きます。
            </span>
          </li>
          <li className="flex gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">3</span>
            <span>出撃した回数と動ける時間を見て、3チームが同じくらいの強さになるように分けます。毎週ちがう顔ぶれです。</span>
          </li>
          <li className="flex gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">4</span>
            <span>町の地図のマスと、シマエナガのマフラーが、あなたのチームの色になります。</span>
          </li>
        </ol>
      </section>

      </Pager>
    </Screen>
  );
}

export default function TeamPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <TeamView searchParams={searchParams} />
    </Suspense>
  );
}
