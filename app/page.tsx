import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import AutoRefresh from "@/components/AutoRefresh";
import Icon from "@/components/Icon";
import Mascot from "@/components/Mascot";
import SkyBackdrop from "@/components/SkyBackdrop";
import TabBar from "@/components/TabBar";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { progress } from "@/lib/morning/view";
import { listShort } from "@/lib/morning/watch";
import { teamTheme } from "@/lib/team-theme";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";
import { captainLine, captainState } from "@/lib/captain";
import { safetyLine } from "@/lib/safety";
import { soloStatus } from "@/lib/solo/ops";
import { jstMinutes } from "@/lib/jst";
import { currentWeatherCode, parseSkyParam, timeOfDay, weatherOf } from "@/lib/sky";
import { TOWN } from "@/lib/town";
import { activeHelpers } from "@/lib/morning/rounds";
import { isDokayuki, isWorkHours, MORNING_BONUS_UNTIL_MIN } from "@/lib/game/hours";

export const metadata: Metadata = { title: "シマエナGO ・ 10分の雪かきで、町が変わる" };

/**
 * ホーム = 今朝の出撃画面（spec v1.1 10.6）。スクロールしない1画面:
 * キャラクターと町 → 今日のミッション（あと何軒） → 今日の数字 → 出動する／10分だけ手伝う → 下のタブ。
 * チームの得点・実況・応援・カード・SNS は「くわしく」（/today）へ。
 */
async function Today({ searchParams }: { searchParams: Promise<{ as?: string; sky?: string }> }) {
  await connection();
  const { as, sky: skyParam } = await searchParams;
  const [record, roster, cookieStore, weatherCode] = await Promise.all([
    loadMorning(),
    loadRoster(),
    cookies(),
    parseSkyParam(skyParam) ? Promise.resolve(undefined) : currentWeatherCode(TOWN.center),
  ]);
  const m = record.morning;
  // 背景の空: いまの天気と時間（デモでは ?sky=night-snow のように上書きできる）
  const sky = parseSkyParam(skyParam) ?? { time: timeOfDay(jstMinutes()), weather: weatherOf(weatherCode, m.rollcall.status === "closed" ? 0 : m.rollcall.forecastCm) };
  const demoAs = as && isDemoViewer(as) ? as : undefined;
  const viewerId = demoAs ?? readViewer(cookieStore.get(VIEWER_COOKIE)?.value);
  const me = viewerId ? roster.participants.find((p) => p.id === viewerId) : undefined;
  const q = demoAs ? `?as=${demoAs}` : "";

  const prog = progress(m);
  // 1日に何回でも（spec v1.8）: 6〜19時ならいつでも。いま雪かき中の人数と、朝・ドカ雪のボーナス
  const nowMin = jstMinutes();
  const open = isWorkHours();
  const activeNow = activeHelpers(m);
  const bonuses = [
    open && nowMin < MORNING_BONUS_UNTIL_MIN ? "朝ボーナス+5" : "",
    open && m.rollcall.status !== "closed" && isDokayuki(m.rollcall.forecastCm) ? "ドカ雪+5" : "",
  ].filter(Boolean);
  const shorts = listShort(record, roster);
  const planned = m.rollcall.status === "planned";
  const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
  // 出動する: 作戦中で手伝う側（チームあり）なら町の地図（家の雪かき）、そうでなければソロ出動
  const canHelpHouse = planned && me?.role === "helper" && Boolean(me.teamId);
  const goHref = canHelpHouse ? `/map${q}` : `/solo${q}`;
  // 10分だけ手伝う: いつもソロ出動（チームの人も、自分の家の雪かきや見回りができるように）
  const fiveHref = `/solo?pick=10${demoAs ? `&as=${demoAs}` : ""}`;
  const next = shorts[0];
  // 1週間のチーム: 見出しの色・シマエナガのマフラー・チームの札（押すと /team）
  const myTeam = me?.role === "helper" && me.teamId ? teamTheme(me.teamId) : undefined;
  // 隊長のひとこと（spec v1.6）: 状態は計算、文は朝に1回だけ書いたもの（なければ定型）
  const st = me ? await soloStatus(me.id, new Date()).catch(() => undefined) : undefined;
  const last = st?.recent[0]?.date;
  const daysSinceLast = st && last ? Math.round((Date.parse(st.today) - Date.parse(last)) / 86400000) : st && st.cards > 0 ? 7 : undefined;
  const rc = m.rollcall;
  const captain = captainLine(
    captainState({
      safety: rc.status !== "closed" && Boolean(safetyLine({ cm: rc.forecastCm, tempMinC: rc.tempMinC, windMaxMs: rc.windMaxMs })),
      role: me?.role,
      almostGoal: planned && prog.total > 0 && prog.left === 1,
      cards: st?.cards ?? 0,
      todayActs: st?.doneToday.length ?? 0,
      streak: st?.streak ?? 0,
      daysSinceLast,
    }),
    record.captainLines,
  );

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
            <p className="whitespace-nowrap text-sm font-bold max-[380px]:text-xs">10分の雪かきで、町が変わる。</p>
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

      {/* 真ん中: 空と雪の町（天気と時間で変わる）、しゃべるシマエナ隊長 */}
      <div className="relative min-h-10 flex-1 overflow-hidden">
        <SkyBackdrop sky={sky} />
        {/* 隊長の吹き出し（しっぽは隊長の口元へ） */}
        <div className="speech-pop absolute left-3 top-2 z-10 max-w-[78%] short:top-1">
          <p className="relative rounded-3xl bg-card px-4 py-2 text-lg font-bold leading-snug shadow-md ring-2 ring-ink/15 short:py-1">
            <span className="block text-sm font-bold text-lamp-deep">シマエナ隊長</span>
            {captain}
          </p>
          <svg viewBox="0 0 40 30" className="absolute -bottom-[22px] right-[14%] h-[26px] w-9" aria-hidden="true">
            <path d="M2 0 C10 10 24 22 38 28 C30 18 26 8 26 0 Z" fill="var(--card)" stroke="rgba(41,68,92,.15)" strokeWidth="2" strokeLinejoin="round" />
            <path d="M3 -2 H25 V3 H3 Z" fill="var(--card)" />
          </svg>
        </div>
        {/* 枝にとまるシマエナ隊長 */}
        <svg viewBox="0 0 200 40" preserveAspectRatio="none" className="absolute bottom-[14%] right-0 h-6 w-3/5" aria-hidden="true">
          <path d="M0 30 C60 22 120 18 200 8" stroke="#7a5a44" strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M120 19 L150 2" stroke="#7a5a44" strokeWidth="5" strokeLinecap="round" />
          <path d="M10 26 C60 18 120 14 196 4" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none" />
        </svg>
        <Mascot team={myTeam?.team.id} className="absolute bottom-[17%] right-[10%] h-[66%] max-h-40 w-auto drop-shadow-md" />
      </div>

      <main className="relative -mt-4 shrink-0 space-y-2.5 px-4 pb-3 short:space-y-2 short:pb-2">
        {/* 今日のミッション・数字（1枚のカード） */}
        <section className="rounded-3xl bg-card px-4 pb-2 pt-3 shadow-md ring-1 ring-ink/10 short:pt-2" aria-label="今日のミッション">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-warm">
              <Icon name="map" size={26} accent="var(--lamp)" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              {prog.total > 0 && !prog.allDone ? (
                <>
                  <p className="text-xl font-bold">
                    あと<span className="mx-1 text-4xl tabular-nums text-lamp">{prog.left}</span>軒で完了！
                  </p>
                  <p className="text-sm font-bold">
                    {next ? `！ 拠点${next.baseNumber}は あと${next.missing}人` : "今朝の雪をどけきれます"}
                  </p>
                </>
              ) : prog.allDone && prog.total > 0 ? (
                <p className="text-xl font-bold">{prog.total}軒すべて完了！<span className="block text-sm">町じゅうに灯りがともりました。</span></p>
              ) : (
                <p className="text-xl font-bold">
                  {m.rollcall.status === "open" ? "点呼中です" : "今日は作戦がありません"}
                  <span className="block text-sm">{m.rollcall.status === "open" ? "（6:40 に行き先。そのあと19時までいつでも）" : "1人の10分でも町は変わります"}</span>
                </p>
              )}
            </div>
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ice-soft text-sm font-bold tabular-nums" aria-label={`進み具合 ${pct}%`}>
              {pct}%
            </span>
          </div>
          <div className="mt-2 grid grid-cols-2 divide-x divide-ink/15 border-t border-ink/10 pt-2 short:mt-1 short:pt-1">
            <p className="flex items-center justify-center gap-2 text-base font-bold">
              <svg viewBox="0 0 40 40" width="28" height="28" aria-hidden="true">
                <circle cx="14" cy="13" r="6" fill="#29445c" />
                <circle cx="27" cy="14" r="5" fill="#3b6584" />
                <path d="M3 33 C3 24 25 24 25 33 Z" fill="#29445c" />
                <path d="M20 32 C21 25 37 24 37 32 Z" fill="#3b6584" />
              </svg>
              <span className="whitespace-nowrap">
                雪かき中 <b className="text-2xl tabular-nums">{activeNow}</b>人
              </span>
            </p>
            <p className="flex items-center justify-center gap-2 text-base font-bold">
              <Icon name="house" size={28} accent="var(--lamp)" className="text-ink" />
              達成 <b className="text-2xl tabular-nums">{prog.done}</b>軒
            </p>
          </div>
        </section>

        {/* 出動（いちばん大事なボタン）と、10分だけ */}
        <Link
          href={goHref}
          className={`btn ${open ? "btn-lamp" : "btn-ink opacity-80"} min-h-18 justify-start gap-3 rounded-full px-5 short:min-h-15 short:py-1.5`}
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-white text-lamp">
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M8 5 L19 12 L8 19 Z" fill="currentColor" />
            </svg>
          </span>
          <span className="text-left leading-tight">
            <span className="block text-2xl">{open ? "出動する" : "夜は自分の家だけ"}</span>
            <span className="block text-sm font-bold">
              {!open ? "よその家の雪かきは6時〜19時" : bonuses.length > 0 ? `いまなら ${bonuses.join("・")}点` : "19時までなら、いつでも10分から"}
            </span>
          </span>
        </Link>
        <Link href={fiveHref} className="btn btn-white min-h-14 gap-3 rounded-full bg-ice-soft/60 short:py-1">
          <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7 V12 L15.5 14" />
          </svg>
          <span className="text-left leading-tight">
            <span className="block text-lg">10分だけ手伝う</span>
            <span className="block text-sm font-normal">ひとりでOK・自分の家の雪かきも</span>
          </span>
        </Link>
      </main>

      <TabBar active="home" q={q} />
    </div>
  );
}

export default function Home({ searchParams }: { searchParams: Promise<{ as?: string; sky?: string }> }) {
  return (
    <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-paper text-ink">読み込み中…</main>}>
      <Today searchParams={searchParams} />
    </Suspense>
  );
}
