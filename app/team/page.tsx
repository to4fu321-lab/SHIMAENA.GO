// 今週のチーム（T47）。隊長トークのチーム発表の「チームを見る」とホームのチーム札から開く。
// 1週間（月曜〜日曜）のチームを、チームの色・チーム色のマフラーのシマエナガ・期間で大きく見せる。
// 11/7 本人の指摘: 「あなた」にチームのなかま（呼び名とアイコン）と、いまの成績（今週の点の棒グラフ・順位・完了した家・今朝の点）を動きつきで。
// 1画面（11/5 本人の指示）: タブ「あなた／3チーム／しくみ」を横スワイプ。縦にはスクロールしない。
import type { Metadata } from "next";
import { onTeam } from "@/lib/member";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import Avatar from "@/components/Avatar";
import CountUp from "@/components/CountUp";
import Mascot from "@/components/Mascot";
import Pager, { Screen } from "@/components/Pager";
import { addDays } from "@/lib/jst";
import { weekStart, weeklySummary } from "@/lib/game/week";
import { loadRoster } from "@/lib/morning/roster";
import { listMornings, loadMorning } from "@/lib/morning/store";
import { appToday } from "@/lib/morning/today";
import { teamTotals } from "@/lib/morning/view";
import { getProfiles } from "@/lib/mypage/store";
import { listSoloScores } from "@/lib/solo/team-points";
import { teamTerm, teamTheme } from "@/lib/team-theme";
import { TEAMS } from "@/lib/teams";
import type { TeamId } from "@/lib/types";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";
import Bgm from "@/components/Bgm";
import PlayOnMount from "@/components/PlayOnMount";

export const metadata: Metadata = { title: "今週のチーム ・ シマエナGO" };

const CONFETTI_AT = [4, 13, 22, 31, 40, 49, 58, 67, 76, 85, 94];
const MAX_FACES = 8;

async function TeamView({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [roster, record, cookieStore] = await Promise.all([loadRoster(), loadMorning(), cookies()]);
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  const q = demoAs ? `?as=${demoAs}` : "";
  // 週はアプリの「今日」（デモは 12 月の朝）で数える。期間の札・成績・なかまが同じ週を指すように
  const today = appToday(record);
  const term = teamTerm(today);
  const mine = me?.teamId ? teamTheme(me.teamId) : undefined;
  const todayTotals = teamTotals(record.morning);
  const members = (id: string) => roster.participants.filter((p) => onTeam(p) && p.teamId === id);

  // 今週の成績（月曜〜今日）: 雪の朝の点＋雪のない日のソロの点。完了した家はチームごとに数える
  const from = weekStart(today);
  const to = addDays(from, 6);
  const [records, solo] = await Promise.all([listMornings(from, to).catch(() => [record]), listSoloScores(from, to).catch(() => [])]);
  const week = weeklySummary(records, roster, from, new Date().toISOString(), solo);
  const housesBy: Record<TeamId, number> = { salvia: 0, marigold: 0, lupinus: 0 };
  for (const r of records) {
    for (const m of r.morning.missions) {
      if (m.status !== "done") continue;
      for (const t of new Set(r.morning.sorties.filter((x) => x.missionId === m.id).map((x) => x.teamId))) housesBy[t]++;
    }
  }
  const top = Math.max(1, ...TEAMS.map((t) => week.teamTotals[t.id]));
  const rankOf = (id: TeamId) => week.ranking.indexOf(id) + 1;

  // なかま: 呼び名とアイコン（マイページ）。今日 出動した人には印
  const mates = mine ? members(mine.team.id) : [];
  const profiles = await getProfiles(mates.map((p) => p.id)).catch(() => new Map());
  const outToday = new Set(record.morning.sorties.filter((s) => s.status === "going" || s.status === "done").map((s) => s.participantId));
  const faces = [...mates].sort((a, b) => (a.id === me?.id ? -1 : b.id === me?.id ? 1 : Number(outToday.has(b.id)) - Number(outToday.has(a.id))));

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
      {/* 発表（チームの色いっぱいに）→ なかま → いまの成績 */}
      {mine ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <section
            className="relative flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-[2rem] px-4 py-2 text-center shadow-md"
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
            <p className="relative mx-auto inline-block whitespace-nowrap rounded-full bg-white px-4 py-0.5 text-base font-bold shadow-sm max-[380px]:px-3 max-[380px]:text-sm" style={{ color: mine.deep }}>
              🎉 今週のあなたのチーム 🎉
            </p>
            <PlayOnMount sounds={[{ name: "drumroll" }, { name: "welcome", delay: 0.8 }]} />
            <Mascot team={mine.team.id} mood="happy" className="team-reveal relative mx-auto mt-1 h-auto min-h-0 w-auto max-h-28 flex-1 drop-shadow-lg short:max-h-16" />
            <p className="relative text-base font-bold short:hidden">あなたは</p>
            <h1 className={`team-name relative font-bold leading-tight ${mine.team.name.length > 5 ? "whitespace-nowrap text-[2.4rem] short:text-3xl" : "text-5xl tracking-wide short:text-4xl"}`}>{mine.team.name}</h1>
            <p className="relative text-sm font-bold tracking-[0.3em] short:hidden">TEAM {mine.team.nameEn}</p>
            <p className="relative mx-auto mt-1.5 inline-block whitespace-nowrap rounded-full bg-ink px-4 py-1 text-base font-bold text-white max-[380px]:text-sm">{term.label}</p>
          </section>

          {/* チームのなかま（呼び名とアイコン。家の場所は出さない） */}
          <section className="shrink-0 rounded-3xl bg-card px-3 pb-2 pt-1.5 shadow-sm ring-1 ring-ink/10" aria-label="チームのなかま">
            <p className="flex items-baseline gap-2 text-base font-bold">
              なかま <span className="text-xl tabular-nums" style={{ color: mine.deep }}>{mates.length}</span>人
              {outToday.size > 0 && <span className="ml-auto text-xs font-bold text-ink-soft">● 今日 出動</span>}
            </p>
            <ul className="mt-1 flex gap-2 overflow-x-auto overflow-y-hidden pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="なかまの一覧">
              {faces.slice(0, MAX_FACES).map((p, i) => {
                const pr = profiles.get(p.id);
                const isMe = p.id === me?.id;
                return (
                  <li key={p.id} className="member-pop flex w-16 shrink-0 flex-col items-center text-center" style={{ animationDelay: `${0.5 + i * 0.09}s` }}>
                    <span className="relative">
                      <Avatar icon={pr?.icon} bg={pr?.iconBg} size={48} team={mine.team.id} />
                      {outToday.has(p.id) && <span className="absolute -right-0.5 -top-0.5 size-3.5 rounded-full bg-lamp ring-2 ring-white" aria-label="今日 出動" />}
                    </span>
                    <span className={`mt-0.5 w-full truncate text-xs leading-tight ${isMe ? "font-bold" : ""}`}>{isMe ? "あなた" : p.nickname}</span>
                  </li>
                );
              })}
              {faces.length > MAX_FACES && (
                <li className="member-pop flex w-16 shrink-0 flex-col items-center text-center" style={{ animationDelay: `${0.5 + MAX_FACES * 0.09}s` }}>
                  <span className="grid size-12 place-items-center rounded-full bg-ice-soft text-base font-bold">+{faces.length - MAX_FACES}</span>
                  <span className="mt-0.5 text-xs leading-tight">ほか</span>
                </li>
              )}
            </ul>
          </section>

          {/* いまの成績: 今週の点の棒（3チーム）と、順位・完了した家・今朝の点 */}
          <section className="shrink-0 rounded-3xl bg-card px-3 pb-2 pt-1.5 shadow-sm ring-1 ring-ink/10" aria-label="いまの成績">
            <p className="flex items-baseline gap-2 text-base font-bold">
              今週の成績
              <span className="ml-auto rounded-full px-2.5 py-0.5 text-sm font-bold text-white" style={{ background: mine.team.color, color: mine.onColor }}>
                いま {rankOf(mine.team.id)}位
              </span>
            </p>
            <ul className="mt-1 space-y-1" aria-label="今週の点（3チーム）">
              {[...TEAMS].sort((a, b) => week.teamTotals[b.id] - week.teamTotals[a.id]).map((t, i) => {
                const th = teamTheme(t.id);
                const isMine = t.id === mine.team.id;
                const pct = Math.max(4, Math.round((week.teamTotals[t.id] / top) * 100));
                return (
                  <li key={t.id} className="grid grid-cols-[4.6em_1fr_3.2em] items-center gap-2 text-sm">
                    <span className={`truncate ${isMine ? "font-bold" : ""}`} style={{ color: th.deep }}>{t.name}</span>
                    <span className="block h-4 overflow-hidden rounded-full bg-ice-soft">
                      <span className="bar-grow block h-full rounded-full" style={{ width: `${pct}%`, background: t.color, animationDelay: `${0.3 + i * 0.15}s`, opacity: isMine ? 1 : 0.55 }} />
                    </span>
                    <span className={`text-right tabular-nums ${isMine ? "font-bold" : ""}`}>
                      <CountUp to={week.teamTotals[t.id]} delay={400 + i * 150} />点
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-1.5 grid grid-cols-3 divide-x divide-ink/15 border-t border-ink/10 pt-1 text-center text-xs font-bold">
              <p><span className="block text-xl" style={{ color: mine.deep }}><CountUp to={week.teamTotals[mine.team.id]} delay={700} /></span>今週の点</p>
              <p><span className="block text-xl" style={{ color: mine.deep }}><CountUp to={housesBy[mine.team.id]} delay={850} /></span>完了した家</p>
              <p><span className="block text-xl" style={{ color: mine.deep }}><CountUp to={todayTotals[mine.team.id] ?? 0} delay={1000} /></span>今朝の点</p>
            </div>
          </section>
        </div>
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
                <p className="text-sm">{t.colorName}・{members(t.id).length}人</p>
                <p className="text-sm font-bold tabular-nums">今週 {week.teamTotals[t.id]}点<span className="block text-xs font-normal">今朝 {todayTotals[t.id] ?? 0}点・{rankOf(t.id)}位</span></p>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-center text-sm text-ink-soft">{term.label}の点。日曜の夜に締めて、実況と称号が届きます。</p>
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
    <>
      <Bgm track="morning" />
      <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
        <TeamView searchParams={searchParams} />
      </Suspense>
    </>
  );
}
