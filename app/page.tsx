import { MENU } from "@/lib/brand";
import type { Metadata } from "next";
import StormBanner from "@/components/StormBanner";
import Link from "next/link";
import { onTeam } from "@/lib/member";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import AutoRefresh from "@/components/AutoRefresh";
import Icon from "@/components/Icon";
import Mascot from "@/components/Mascot";
import Avatar from "@/components/Avatar";
import { getProfile } from "@/lib/mypage/store";
import CaptainStage from "@/components/CaptainStage";
import SkyBackdrop from "@/components/SkyBackdrop";
import TabBar from "@/components/TabBar";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { progress } from "@/lib/morning/view";
import { listShort } from "@/lib/morning/watch";
import { teamTheme } from "@/lib/team-theme";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";
import { captainLine, captainRotation, captainState } from "@/lib/captain";
import { safetyLine } from "@/lib/safety";
import { soloStatus } from "@/lib/solo/ops";
import { jstMinutes } from "@/lib/jst";
import { currentWeather, parseSkyParam, timeOfDay, weatherOf } from "@/lib/sky";
import HomeCheerButtons from "@/components/HomeCheerButtons";
import SoundToggle from "@/components/SoundToggle";
import { cheerButtons, myCheerNews } from "@/lib/solo/cheer-ops";
import { arrivalLines } from "@/lib/solo/home-cheer";
import { restLine } from "@/lib/claude/rest";
import { TOWN } from "@/lib/town";
import { repo } from "@/lib/repo";
import { appToday } from "@/lib/morning/today";
import { countHomeNow } from "@/lib/solo/home-now";
import { activeHelpers } from "@/lib/morning/rounds";
import { isDokayuki, isWorkHours, MORNING_BONUS_UNTIL_MIN } from "@/lib/game/hours";
import Bgm from "@/components/Bgm";
import SnowSongChip from "@/components/SnowSongChip";
import GoButton, { type GoReason } from "@/components/GoButton";
import { loadSnowSong, warmSnowSong } from "@/lib/song/day";
import { hasClaudeKey } from "@/lib/claude/client";
import { runLater } from "@/lib/ops/later";

export const metadata: Metadata = { title: "シマエナGO ・ 10分の雪かきで、町が変わる" };

/**
 * ホーム = 今朝の出撃画面（spec v1.1 10.6）。スクロールしない1画面:
 * キャラクターと町 → 今日のミッション（あと何軒） → 今日の数字 → 雪かきGO！／ソロ活動をする → 下のタブ。
 * 右上は使い方と設定。SNS・友だちを誘う・応援を呼ぶ・バトン・なかまは「つなぐ」（/connect、下のタブとホームの「仲間を増やす」）へ。
 */
async function Today({ searchParams }: { searchParams: Promise<{ as?: string; sky?: string }> }) {
  await connection();
  const { as, sky: skyParam } = await searchParams;
  const [record, roster, cookieStore, wx] = await Promise.all([
    loadMorning(),
    loadRoster(),
    cookies(),
    parseSkyParam(skyParam) ? Promise.resolve({} as Awaited<ReturnType<typeof currentWeather>>) : currentWeather(TOWN.center),
  ]);
  const m = record.morning;
  // 今朝の雪の歌（spec v1.28）: まだなければ作る。Claude に頼むときは返事のあとで（次の自動更新で出る）
  const songDay = appToday(record);
  const song = (await loadSnowSong(songDay)) ?? (hasClaudeKey() ? (runLater("song/warm", async () => void (await warmSnowSong(songDay))), undefined) : await warmSnowSong(songDay));
  // 背景の空: いまの天気と時間（デモでは ?sky=night-snow のように上書きできる）
  const sky = parseSkyParam(skyParam) ?? { time: timeOfDay(jstMinutes()), weather: weatherOf(wx.code, m.rollcall.status === "closed" ? 0 : m.rollcall.forecastCm) };
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
  // 「雪かきを頼む」で開いた、まだ終わっていない家（spec v1.10）
  const asks = m.missions.filter((x) => x.ask && x.status !== "done").length;
  const pct = prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0;
  // 雪かきGO！: 作戦中で手伝う側（チームあり）なら町の地図（家の雪かき）、そうでなければソロ出動
  const canHelpHouse = planned && onTeam(me);
  const goHref = canHelpHouse ? `/map${q}` : `/solo${q}`;
  // 近所のお願いがない（作戦がまだ・頼む家が 0 軒）: はっきり伝えて、自宅の雪かきと道の危険を知らせるへ誘導（11/7 本人の指示）
  const noRequests = asks === 0 && prog.total === 0;
  const ownHouseHref = `/solo?pick=10&focus=own_house${demoAs ? `&as=${demoAs}` : ""}`;
  const roadHref = `/solo?pick=10&focus=report_snow${demoAs ? `&as=${demoAs}` : ""}`;
  // 地図に行けないときの理由（押したら案内の紙を出してからソロへ。11/7 本人の指摘）
  const goReason: GoReason = !planned ? "no-plan" : !me ? "guest" : "no-team";
  // ソロ活動をする: いつもソロ出動（チームの人も、自分の家の雪かきや見回りができるように）
  const fiveHref = `/solo?pick=10${demoAs ? `&as=${demoAs}` : ""}`;
  const next = shorts[0];
  // 1週間のチーム: 見出しの色・シマエナガのマフラー・チームの札（押すと /team）
  const myTeam = onTeam(me) && me?.teamId ? teamTheme(me.teamId) : undefined;
  // 左上の鳥は、マイページ（spec v1.32）のアイコン。押すとマイページ（アイコン・紹介・なかま帳）
  // 本人の記録・夜の人数・応援・アイコンは互いに関係ないので、まとめて同時に読む（ホームは8秒ごとに取り直すので、待ち時間を短く）
  const now = new Date();
  const night = !open;
  const [st, homeToday, cheerBtn, news, myIcon] = await Promise.all([
    me ? soloStatus(me.id, now).catch(() => undefined) : undefined,
    // 夜（19時〜6時）は、よその家の数字（あと何軒）の代わりに、今日 自分の家の雪かきを終えた人の数も
    night
      ? repo()
          .listSoloLogsBetween(appToday(record), appToday(record))
          .then((ls) => new Set(ls.filter((l) => l.kind === "own_house").map((l) => l.participantId)).size)
          .catch(() => 0)
      : 0,
    // 応援・おつかれさま（11/4）: 送るボタンの数と、自分に届いた知らせ（隊長が飛んできて話す）
    me ? cheerButtons(me.id, now).catch(() => undefined) : undefined,
    me ? myCheerNews(me.id, now).catch(() => undefined) : undefined,
    me ? getProfile(me.id).catch(() => undefined) : undefined,
  ]);
  // 隊長のひとこと（spec v1.6）: 状態は計算、文は朝に1回だけ書いたもの（なければ定型）
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
  const safety = rc.status !== "closed" ? safetyLine({ cm: rc.forecastCm, tempMinC: rc.tempMinC, windMaxMs: rc.windMaxMs }) : undefined;
  // いま自宅を雪かき中の人（ソロの自分の家の「出撃する！」、リアルタイム）。夜はこれだけを出す
  const homeNow = countHomeNow(record, now);
  // 休みのひとこと（AI）: いまの天気と、今日この人が動いた回数から
  const myHouseDone = me ? m.sorties.filter((x) => x.participantId === me.id && x.status === "done" && x.completedAt && appToday(record) === m.rollcall.date).length : 0;
  const rest = me
    ? await restLine(appToday(record), {
        todayCount: (st?.doneToday.length ?? 0) + myHouseDone,
        weather: sky.weather,
        tempC: wx.tempC,
        windMs: wx.windMs,
        timeOfDay: sky.time,
        snowCm: rc.status !== "closed" ? rc.forecastCm : undefined,
      }).catch(() => undefined)
    : undefined;
  const captainLines = captainRotation({
    main: captain,
    safety: safety && safety !== captain ? safety : undefined,
    snowCm: rc.status !== "closed" ? rc.forecastCm : undefined,
    snowName: rc.status !== "closed" ? rc.snowName : undefined,
    active: activeNow + homeNow,
    left: planned ? prog.left : 0,
    night,
    homeToday,
    homeNow,
    morningBonus: bonuses.includes("朝ボーナス+5"),
    dokayuki: bonuses.includes("ドカ雪+5"),
    teamName: myTeam?.team.name,
  });
  if (rest) captainLines.splice(1, 0, rest);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-md flex-col overflow-hidden bg-paper text-ink">
      <AutoRefresh seconds={8} />
      <StormBanner />
      {/* 上: ロゴ・ひとこと・くわしく */}
      <header className="flex shrink-0 flex-wrap items-center gap-x-2 bg-ice-soft px-4 pt-3 short:pt-1.5" style={myTeam ? { background: myTeam.soft } : undefined}>
        {me ? (
          <Link href={`/me${q}`} aria-label="マイページ（アイコン・紹介・なかま帳）" className="grid size-12 shrink-0 place-items-center rounded-full bg-card shadow-sm">
            {myIcon && myIcon.icon !== "bird" ? <Avatar icon={myIcon.icon} bg={myIcon.iconBg} size={44} ring={false} /> : <Mascot size={40} team={myTeam?.team.id} />}
          </Link>
        ) : (
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-card shadow-sm">
            <Mascot size={40} team={myTeam?.team.id} />
          </span>
        )}
        <div className="min-w-0 flex-1 leading-tight">
          <h1 className="whitespace-nowrap text-2xl font-bold max-[400px]:text-xl">
            シマエナ<span className="text-lamp-deep">GO</span>
          </h1>
          {!myTeam && <p className="whitespace-nowrap text-sm font-bold max-[380px]:text-xs">10分の雪かきで、町が変わる。</p>}
        </div>
        {/* BGM のオン・オフ（spec v1.19）。効果音は設定の「音」で */}
        <SoundToggle compact />
        {/* 使い方（下のタブを「つなぐ」にしたので、ここと設定から。11/6） */}
        <Link href="/rules" className="flex min-h-12 shrink-0 flex-col items-center justify-center px-1 text-xs font-bold" aria-label="使い方">
          <Icon name="guide" size={28} accent="var(--ice)" />
          使い方
        </Link>
        {/* 設定（11/6: 「くわしく」をやめて、中身は地図・チーム・つなぐへ） */}
        <Link href={`/settings${q}`} className="flex min-h-12 shrink-0 flex-col items-center justify-center px-1 text-xs font-bold" aria-label="設定">
          <Icon name="settings" size={28} accent="var(--ice)" />
          設定
        </Link>
        {/* 今週のあなたのチーム（1行まるごと。チーム名を大きな札に） */}
        {myTeam && (
          <Link
            href={`/team${q}`}
            className="mb-1.5 mt-1 flex basis-full items-center gap-2 whitespace-nowrap text-sm font-bold"
            aria-label={`今週のあなたのチームは${myTeam.team.name}（チームを見る）`}
          >
            今週のあなたのチームは
            <span
              className="inline-flex items-center gap-1 rounded-full px-3.5 py-0.5 text-lg font-black shadow-md ring-2 ring-white max-[380px]:text-base"
              style={{ background: myTeam.team.color, color: myTeam.onColor }}
            >
              {myTeam.team.name}
              <span aria-hidden="true">›</span>
            </span>
          </Link>
        )}
      </header>

      {/* 真ん中: 空と雪の町（天気と時間で変わる）、しゃべるシマエナ隊長 */}
      <div className="relative min-h-10 flex-1 overflow-hidden">
        <SkyBackdrop sky={sky} />
        {song && <SnowSongChip song={song} q={q} />}
        {/* しゃべって動くシマエナ隊長（ことばは順番に。タップで飛ぶ） */}
        <CaptainStage lines={captainLines} team={myTeam?.team.id} arrival={news ? arrivalLines(news) : []} viewerId={me?.id} chatHref={`/chat${q}`} />
      </div>

      <main className="relative -mt-3 shrink-0 space-y-2 px-4 pb-2.5 short:space-y-1.5 short:pb-1.5">
        {/* 今日のミッション・数字（1枚のカード） */}
        <section
          className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#eaf3fa] to-card px-4 pb-2 pt-2 shadow-md ring-2 ring-[#8fb8d9] short:pt-1.5 short:pb-1.5"
          aria-label="今日のミッション"
        >
          {/* 雪の結晶の飾り（枠で目立たせる） */}
          <span aria-hidden="true" className="pointer-events-none absolute right-3 top-1.5 text-lg text-[#8fb8d9]/80">❄</span>
          <span aria-hidden="true" className="pointer-events-none absolute right-8 top-6 text-xs text-[#8fb8d9]/70">❄</span>
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-warm">
              <Icon name="map" size={26} accent="var(--lamp)" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              {night ? (
                <p className="text-lg font-bold">今夜は自分の家の雪かき</p>
              ) : prog.total > 0 && !prog.allDone ? (
                <>
                  <p className="text-lg font-bold">
                    あと<span className="mx-1 text-4xl tabular-nums text-lamp">{prog.left}</span>軒で完了！
                  </p>
                  <p className="text-sm font-bold">
                    {next ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-alert-soft px-2.5 py-0.5 text-alert ring-1 ring-alert/30">
                        ！ 拠点{next.baseNumber}は あと{next.missing}人
                      </span>
                    ) : (
                      "今朝の雪をどけきれます"
                    )}
                  </p>
                </>
              ) : prog.allDone && prog.total > 0 ? (
                <p className="text-lg font-bold">{prog.total}軒すべて完了！<span className="block text-sm">町じゅうに灯りがともりました。</span></p>
              ) : (
                <p className="text-lg font-bold">
                  {asks > 0 ? (
                    `雪かきのお願い ${asks}軒`
                  ) : (
                    // 近所のお願いがない: 理由をはっきり、やれることへ誘導（11/7 本人の指示）
                    <>
                      近所のお願いは いまなし
                      {rc.status !== "closed" && rc.forecastCm > 0 && (
                        <span className="ml-2 inline-block rounded-full bg-ice-soft px-2 py-0.5 align-middle text-sm font-bold whitespace-nowrap">今日の雪 {rc.forecastCm}cm</span>
                      )}
                    </>
                  )}
                  <span className="block text-sm">
                    {asks > 0 ? "地図の待っている家へ。10分だけでも大歓迎" : "頼む家のお願いが出ると地図に出ます。それまでは下の2つをどうぞ"}
                  </span>
                </p>
              )}
            </div>
            {!night && prog.total > 0 && (
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-ice-soft text-sm font-bold tabular-nums" aria-label={`進み具合 ${pct}%`}>
                {pct}%
              </span>
            )}
          </div>
          <div className="mt-1.5 grid grid-cols-2 divide-x divide-ink/15 border-t border-ink/10 pt-1.5 short:mt-1 short:pt-1">
            <p className="flex items-center justify-center gap-2 text-base font-bold">
              <svg viewBox="0 0 40 40" width="28" height="28" aria-hidden="true" className="shrink-0">
                <circle cx="14" cy="13" r="6" fill="#29445c" />
                <circle cx="27" cy="14" r="5" fill="#3b6584" />
                <path d="M3 33 C3 24 25 24 25 33 Z" fill="#29445c" />
                <path d="M20 32 C21 25 37 24 37 32 Z" fill="#3b6584" />
              </svg>
              {night ? (
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <span className="text-xs leading-tight">
                    自宅を
                    <br />
                    雪かき中
                  </span>
                  <b className="text-2xl tabular-nums">{homeNow}</b>人
                </span>
              ) : (
                <span className="whitespace-nowrap">
                  雪かき中 <b className="text-2xl tabular-nums">{activeNow + homeNow}</b>人
                </span>
              )}
            </p>
            <p className="flex items-center justify-center gap-2 text-base font-bold">
              <Icon name="house" size={28} accent="var(--lamp)" className="text-ink" />
              {night ? (
                <span className="flex items-center gap-1 whitespace-nowrap">
                  <span className="text-xs leading-tight">
                    今日 自宅を
                    <br />
                    終えた人
                  </span>
                  <b className="text-2xl tabular-nums">{homeToday}</b>人
                </span>
              ) : (
                <>
                  達成 <b className="text-2xl tabular-nums">{prog.done}</b>軒
                </>
              )}
            </p>
          </div>
          {me && cheerBtn && <HomeCheerButtons viewerId={me.id} {...cheerBtn} />}
        </section>

        {/* 出動（いちばん大事なボタン）と、ソロ活動。夜は「近隣の雪かき（明日6時から）」をグレーにして、ソロと半分ずつ1行に */}
        {!open ? (
          <div className="grid grid-cols-2 gap-2">
            <p
              aria-disabled="true"
              className="flex min-h-14 items-center gap-2 rounded-full bg-ink/10 px-3 max-[380px]:gap-1.5 max-[380px]:px-2.5 text-ink/55 ring-1 ring-ink/10"
            >
              <span aria-hidden="true" className="text-xl">🌙</span>
              <span className="min-w-0 leading-tight">
                <span className="block whitespace-nowrap text-base font-bold max-[380px]:text-sm">近隣の雪かき</span>
                <span className="block text-xs font-bold">明日6時から</span>
              </span>
            </p>
            <Link href={fiveHref} className="flex min-h-14 items-center gap-2 rounded-full bg-lamp px-3 max-[380px]:gap-1.5 max-[380px]:px-2.5 text-white shadow-md">
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" className="shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7 V12 L15.5 14" />
              </svg>
              <span className="min-w-0 leading-tight">
                <span className="block whitespace-nowrap text-base font-bold max-[380px]:text-sm">ソロ活動</span>
                <span className="block whitespace-nowrap text-xs font-bold">自宅の雪かき</span>
              </span>
            </Link>
          </div>
        ) : noRequests ? (
          // 近所のお願いがない昼: 「雪かきGO！」の代わりに、自宅の雪かきと道の危険を知らせるへ（11/7 本人の指示）
          <div className="grid grid-cols-2 gap-2">
            <Link href={ownHouseHref} className="flex min-h-14 items-center gap-2 rounded-full bg-lamp px-3 max-[380px]:gap-1.5 max-[380px]:px-2.5 text-white shadow-md">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-lamp">
                <Icon name="house" size={22} accent="var(--lamp)" />
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block whitespace-nowrap text-base font-bold max-[380px]:text-sm">自宅の雪かき</span>
                <span className="block whitespace-nowrap text-xs font-bold">何回でも・+8羽</span>
              </span>
            </Link>
            <Link href={roadHref} className="flex min-h-14 items-center gap-2 rounded-full bg-card px-3 max-[380px]:gap-1.5 max-[380px]:px-2.5 text-ink shadow-md ring-1 ring-ink/15">
              <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-warm text-lg">⚠️</span>
              <span className="min-w-0 leading-tight">
                <span className="block whitespace-nowrap text-base font-bold max-[380px]:text-sm">道の危険</span>
                <span className="block whitespace-nowrap text-xs font-bold">写真で・+5羽</span>
              </span>
            </Link>
          </div>
        ) : (
          // 昼も夜と同じ形（11/6 本人の指示）: 左に雪かきGO！、右にソロ活動。半分ずつ1行
          <div className="grid grid-cols-2 gap-2">
            <GoButton
              href={goHref}
              direct={canHelpHouse}
              reason={goReason}
              soloHref={`/solo${q}`}
              className="flex min-h-14 items-center gap-2 rounded-full bg-lamp px-3 max-[380px]:gap-1.5 max-[380px]:px-2.5 text-white shadow-md"
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-lamp">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M8 5 L19 12 L8 19 Z" fill="currentColor" />
                </svg>
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block whitespace-nowrap text-base font-bold max-[380px]:text-sm">{MENU.go.label}</span>
                <span className="block whitespace-nowrap text-xs font-bold">{!canHelpHouse ? "自宅の雪かきへ" : bonuses.length > 0 ? `${bonuses[0]}点` : "近所の家へ"}</span>
              </span>
            </GoButton>
            <Link href={fiveHref} className="flex min-h-14 items-center gap-2 rounded-full bg-card px-3 max-[380px]:gap-1.5 max-[380px]:px-2.5 text-ink shadow-md ring-1 ring-ink/15">
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" className="shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7 V12 L15.5 14" />
              </svg>
              <span className="min-w-0 leading-tight">
                <span className="block whitespace-nowrap text-base font-bold max-[380px]:text-sm">ソロ活動</span>
                <span className="block whitespace-nowrap text-xs font-bold">自宅の雪かき</span>
              </span>
            </Link>
          </div>
        )}
        {/* 雪かきを頼む（spec v1.20 お互いさま）と、仲間を増やす（つなぐ。11/6 本人の指示「ホームからも仲間を増やすボタン」） */}
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/ask${q}`} className="flex min-h-12 items-center gap-2 rounded-full bg-card pl-1.5 pr-3 shadow-sm ring-1 ring-ink/15 short:min-h-11">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warm">
              <Icon name="ask" size={24} accent="var(--camellia)" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block whitespace-nowrap text-base font-bold max-[380px]:text-sm">お願いする</span>
              <span className="block whitespace-nowrap text-xs text-ink-soft">うちの雪かきを</span>
            </span>
          </Link>
          <Link href={`/connect${q}`} className="flex min-h-12 items-center gap-2 rounded-full bg-card pl-1.5 pr-3 shadow-sm ring-1 ring-ink/15 short:min-h-11">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-camellia-soft">
              <Icon name="connect" size={24} accent="var(--lamp)" />
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block whitespace-nowrap text-base font-bold max-[380px]:text-sm">仲間を増やす</span>
              <span className="block whitespace-nowrap text-xs text-ink-soft">誘う・広める</span>
            </span>
          </Link>
        </div>
      </main>

      <TabBar active="home" q={q} />
    </div>
  );
}

export default function Home({ searchParams }: { searchParams: Promise<{ as?: string; sky?: string }> }) {
  return (
    <>
      <Bgm track="morning" />
      <Suspense fallback={<main className="grid min-h-dvh place-items-center bg-paper text-ink">読み込み中…</main>}>
        <Today searchParams={searchParams} />
      </Suspense>
    </>
  );
}
