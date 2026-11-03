import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import AutoRefresh from "@/components/AutoRefresh";
import Icon from "@/components/Icon";
import Mascot, { SnowTown } from "@/components/Mascot";
import TabBar from "@/components/TabBar";
import { loadPublicStats } from "@/lib/public/load";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { progress } from "@/lib/morning/view";
import { listShort } from "@/lib/morning/watch";
import { teamTheme } from "@/lib/team-theme";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

export const metadata: Metadata = { title: "シマエナGO ・ 5分の雪かきで、町が変わる" };

/** 今日の数字の小さなカード */
function Stat({ label, value, unit, icon }: { label: string; value: number; unit: string; icon: "house" | "people" }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-card px-3 py-2 shadow-sm ring-1 ring-ink/10 short:py-1">
      {icon === "house" ? (
        <Icon name="house" size={34} accent="var(--lamp)" className="shrink-0 text-ink" />
      ) : (
        <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true" className="shrink-0">
          <circle cx="14" cy="13" r="6" fill="#29445c" />
          <circle cx="27" cy="14" r="5" fill="#3b6584" />
          <path d="M3 33 C3 24 25 24 25 33 Z" fill="#29445c" />
          <path d="M20 32 C21 25 37 24 37 32 Z" fill="#3b6584" />
        </svg>
      )}
      <p className="min-w-0 leading-tight">
        <span className="block text-sm font-bold">{label}</span>
        <span className="text-3xl font-bold tabular-nums short:text-2xl">{value}</span>
        <span className="ml-0.5 text-base font-bold">{unit}</span>
      </p>
    </div>
  );
}

/**
 * ホーム = 今朝の出撃画面（spec v1.1 10.6）。スクロールしない1画面:
 * キャラクターと町 → 今日のミッション（あと何軒） → 今日の数字 → 出動する／5分だけ手伝う → 下のタブ。
 * チームの得点・実況・応援・カード・SNS は「くわしく」（/today）へ。
 */
async function Today({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const [record, roster, cookieStore, stats] = await Promise.all([loadMorning(), loadRoster(), cookies(), loadPublicStats()]);
  const m = record.morning;
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  const q = demoAs ? `?as=${demoAs}` : "";

  const prog = progress(m);
  const shorts = listShort(record, roster);
  const planned = m.rollcall.status === "planned";
  const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
  // 出動する: 作戦中で手伝う側（チームあり）なら町の地図（家の雪かき）、そうでなければソロ出動
  const canHelpHouse = planned && me?.role === "helper" && Boolean(me.teamId);
  const goHref = canHelpHouse ? `/map${q}` : `/solo${q}`;
  // 5分だけ手伝う: いつもソロ出動（チームの人も、自分の家の雪かきや見回りができるように）
  const fiveHref = `/solo?pick=5${demoAs ? `&as=${demoAs}` : ""}`;
  const next = shorts[0];
  // 1週間のチーム: 見出しの色・シマエナガのマフラー・チームの札（押すと /team）
  const myTeam = me?.role === "helper" && me.teamId ? teamTheme(me.teamId) : undefined;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-paper text-ink">
      <AutoRefresh seconds={8} />
      {/* 上: ロゴ・ひとこと・くわしく */}
      <header className="flex shrink-0 items-center gap-2 bg-ice-soft px-4 pt-3 short:pt-1.5" style={myTeam ? { background: myTeam.soft } : undefined}>
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-card shadow-sm">
          <Mascot size={40} team={myTeam?.team.id} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="text-2xl font-bold">
            シマエナ<span className="text-lamp-deep">GO</span>
          </h1>
          {myTeam ? (
            <Link
              href={`/team${q}`}
              className="mt-0.5 inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-bold shadow-sm max-[380px]:text-xs"
              style={{ background: myTeam.team.color, color: myTeam.onColor }}
            >
              <span className="truncate">今週は{myTeam.team.name}</span>
              <span aria-hidden="true">›</span>
            </Link>
          ) : (
            <p className="whitespace-nowrap text-sm font-bold max-[380px]:text-xs">5分の雪かきで、町が変わる。</p>
          )}
        </div>
        <Link href={`/today${q}`} className="relative flex min-h-12 shrink-0 flex-col items-center justify-center px-1 text-xs font-bold" aria-label="くわしく（今朝のようす）">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" />
            <path d="M10 20a2 2 0 0 0 4 0" />
          </svg>
          くわしく
          {shorts.length > 0 && (
            <span className="absolute -right-1 top-0 grid size-5 place-items-center rounded-full bg-lamp text-xs text-white">{shorts.length}</span>
          )}
        </Link>
      </header>

      {/* 真ん中: キャラクターと雪の町（画面の高さに合わせて縮む） */}
      <div className="snowfield relative min-h-10 flex-1 overflow-hidden" aria-hidden="true">
        <SnowTown tower className="absolute inset-x-0 bottom-0 h-[70%] w-full" />
        {/* 枝にとまるシマエナガ */}
        <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="absolute bottom-[14%] right-0 h-6 w-3/5">
          <path d="M0 30 C60 22 120 18 200 8" stroke="#7a5a44" strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M120 19 L150 2" stroke="#7a5a44" strokeWidth="5" strokeLinecap="round" />
          <path d="M10 26 C60 18 120 14 196 4" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
        </svg>
        <Mascot team={myTeam?.team.id} className="absolute bottom-[17%] right-[10%] h-[74%] max-h-44 w-auto drop-shadow-md" />
      </div>

      <main className="relative -mt-4 shrink-0 space-y-2.5 px-4 pb-3 short:space-y-2 short:pb-2">
        {/* 今日のミッション */}
        <section className="rounded-3xl bg-card px-4 pb-3 pt-2.5 shadow-md ring-1 ring-ink/10 short:pb-2 short:pt-1.5" aria-label="今日のミッション">
          <p className="flex items-center gap-1 text-sm font-bold">
            <Icon name="map" size={20} accent="var(--lamp)" />
            今日のミッション
          </p>
          {prog.total > 0 && !prog.allDone ? (
            <>
              <p className="leading-tight">
                <span className="text-2xl font-bold">あと</span>
                <span className="mx-1 text-6xl font-bold tabular-nums text-lamp short:text-5xl">{prog.left}</span>
                <span className="text-2xl font-bold">軒</span>
              </p>
              <p className="text-lg font-bold leading-tight">で今朝の雪をどけきれます！</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="h-3 flex-1 overflow-hidden rounded-full bg-ice-soft">
                  <span className="block h-full rounded-full bg-lamp" style={{ width: `${pct}%` }} />
                </span>
                <span className="text-base font-bold tabular-nums">{pct}%</span>
              </div>
              {next && (
                <p className="mt-1 text-sm font-bold text-alert">
                  ！ 拠点{next.baseNumber}はあと{next.missing}人で救えます
                </p>
              )}
            </>
          ) : prog.allDone && prog.total > 0 ? (
            <p className="py-1 text-2xl font-bold leading-snug">
              {prog.total}軒すべて完了！
              <span className="block text-base">町じゅうに灯りがともりました。</span>
            </p>
          ) : (
            <p className="py-1 text-xl font-bold leading-snug">
              {m.rollcall.status === "open" ? "点呼中です（6:40 に作戦）" : "今朝は雪かきの作戦がありません"}
              <span className="block text-base">1人の5分でも、町を変えられます。</span>
            </p>
          )}
        </section>

        {/* 今日の数字 */}
        <div className="grid grid-cols-2 gap-2.5">
          <Stat label="今日の仲間" value={stats.todayPeople} unit="人" icon="people" />
          <Stat label="今日の達成" value={prog.done} unit="軒" icon="house" />
        </div>

        {/* 出動（いちばん大事なボタン）と、5分だけ */}
        <Link href={goHref} className="btn btn-lamp min-h-18 justify-start gap-3 rounded-full px-5 short:min-h-15 short:py-1.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-lamp">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M8 5 L19 12 L8 19 Z" fill="currentColor" />
            </svg>
          </span>
          <span className="text-left leading-tight">
            <span className="block text-2xl">出動する</span>
            <span className="block text-sm font-bold">近くの雪かきを探す</span>
          </span>
        </Link>
        <Link href={fiveHref} className="btn btn-white min-h-14 gap-3 rounded-full bg-ice-soft/60 short:py-1">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7 V12 L15.5 14" />
          </svg>
          <span className="text-left leading-tight">
            <span className="block text-lg">5分だけ手伝う（ソロ出動）</span>
            <span className="block text-sm font-normal">ひとりでOK・自分の家の雪かきも</span>
          </span>
        </Link>
      </main>

      <TabBar active="home" q={q} />
    </div>
  );
}

export default function Home({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-paper text-ink">読み込み中…</main>}>
      <Today searchParams={searchParams} />
    </Suspense>
  );
}
