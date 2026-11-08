import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { hasClaudeKey } from "@/lib/claude/client";
import { hasLoginKeys } from "@/lib/auth/line-login";
import { clockText } from "@/lib/morning/flow";
import { dbStatus, type DbStatus } from "@/lib/db";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning } from "@/lib/morning/store";
import { progress, snowHp, teamTotals } from "@/lib/morning/view";
import { TEAMS } from "@/lib/teams";
import { helpState, radiusLabel } from "@/lib/morning/watch";
import { CHEER_CHOICES } from "@/lib/morning/cheer";
import {
  announceByForecast,
  answerRandomly,
  backToSample,
  cheerDemo,
  clearProblemsAction,
  completeOne,
  completeOneAuto,
  presentAllTeams,
  presentCheer,
  presentGather,
  presentFinish,
  presentGo,
  helpNextRing,
  prepareDatabase,
  rescue,
  ringNow,
  runCommander,
  reopenDemo,
  runWeekly,
  makeBookNow,
  startEmptyMorning,
  thanksDemo,
  nudgeNow,
  seedRoadReportsDemo,
  seedKikigakiDemo,
  syncFeedbackNow,
  writeImprovementsNow,
  writeRecapNow,
  writeShareTextsNow,
} from "./actions";
import { remakeSnowSong } from "./song-actions";
import AutoComplete from "@/components/AutoComplete";
import PresentationMode from "@/components/PresentationMode";
import { THANKS_CHOICES } from "@/lib/claude/thanks";
import { adminGate } from "@/lib/admin-auth";
import { makeNameMasker } from "@/lib/admin-names";
import { demoEnabled } from "@/lib/env";
import { countOutSince } from "@/lib/inbox/store";
import { monthStartIso } from "@/lib/jst";
import { listProblems } from "@/lib/ops/problems";
import { MOTIVE_LABEL } from "@/lib/concierge/profile";
import { weekStart } from "@/lib/game/week";
import { appToday } from "@/lib/morning/today";
import { countByCategory, listVoicesBetween, loadLatestImprovement, VOICE_LABEL } from "@/lib/voice/store";
import { listRecentFeedback } from "@/lib/feedback/store";
import { KIND_LABEL, KIND_MARK, STATUS_LABEL } from "@/lib/feedback/rules";
import { hasGithubToken } from "@/lib/feedback/github";
import { loginAction, logoutAction } from "./auth-actions";
import Pager, { Screen } from "@/components/Pager";
import PagedNodes from "./PagedNodes";

// v1.24: 完了でカードが出たあと、返事のあとで Claude が絵を描く（after()）。その時間まで関数を止めない
export const maxDuration = 300;

export const metadata: Metadata = { title: "デモ操作 ・ シマエナGO" };

const ROLLCALL_TEXT = { announced: "予告済み", open: "点呼中", planned: "作戦配信済み", closed: "終了" } as const;
const MISSION_TEXT = {
  open: "人を待っている",
  short: "人手不足",
  assigned: "そろった",
  in_progress: "作業中",
  done: "完了",
  no_answer: "返事なし",
} as const;

const STORAGE_TEXT = (db: DbStatus) =>
  db.kind === "none"
    ? "メモリ（開発用）"
    : db.kind === "ready"
      ? `Neon（参加者 ${db.participants} 人）`
      : db.kind === "unprepared"
        ? "Neon（未準備）"
        : "Neon（接続エラー）";

function Step({ n, label, action, disabled }: { n: string; label: string; action: () => Promise<void>; disabled?: boolean }) {
  return (
    <form action={action}>
      <button
        disabled={disabled}
        className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-2 text-left text-lg font-bold text-ink shadow-sm ring-1 ring-ink/10 disabled:opacity-40"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-sm text-white">{n}</span>
        {label}
      </button>
    </form>
  );
}

/** 合言葉の入力（ログインしていないとき） */
function Login({ failed, unconfigured }: { failed: boolean; unconfigured: boolean }) {
  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-4 bg-paper px-4 py-8 text-ink">
      <h1 className="text-2xl font-bold">デモ操作（運営の人だけ）</h1>
      {unconfigured ? (
        <p className="text-lg">
          合言葉がまだ設定されていません。Vercel の環境変数に <b>ADMIN_PASSWORD</b> を入れてください（入れるまで、誰も操作できません）。
        </p>
      ) : (
        <form action={loginAction} className="space-y-3">
          <label className="block text-lg font-bold" htmlFor="password">
            合言葉
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-2xl bg-card px-4 py-3 text-lg ring-1 ring-ink/20"
          />
          {failed && <p className="text-base text-alert">合言葉が違います。</p>}
          <button className="w-full rounded-2xl bg-ink px-4 py-3 text-lg font-bold text-white">開く</button>
        </form>
      )}
    </main>
  );
}

async function AdminContent({ searchParams }: { searchParams: Promise<{ login?: string }> }) {
  await connection();
  const gate = await adminGate();
  if (gate === "login" || gate === "unconfigured") {
    const { login } = await searchParams;
    return <Login failed={login === "failed"} unconfigured={gate === "unconfigured"} />;
  }
  const [s, db, roster, problems, notices] = await Promise.all([loadMorning(), dbStatus(), loadRoster(), listProblems(), countOutSince(monthStartIso()).catch(() => 0)]);
  // 声と改善（spec v1.17）: 今週の声の数と、いちばん新しい提案
  const today = appToday(s);
  const [voices, improvement, feedback] = await Promise.all([listVoicesBetween(weekStart(today), today).catch(() => []), loadLatestImprovement().catch(() => undefined), listRecentFeedback(12).catch(() => [])]);
  const feedbackOpen = feedback.filter((f) => f.status === "open" || f.status === "issued").length;
  const voiceCounts = countByCategory(voices);
  const names = makeNameMasker(roster.participants);
  const m = s.morning;
  const totals = teamTotals(m);
  const hp = snowHp(m);
  const prog = progress(m);
  const name = names.label;
  const helpers = roster.participants.filter((p) => p.role === "helper");
  const lineCount = roster.participants.filter((p) => p.lineUserId).length;
  const status = m.rollcall.status;

  const anyDone = m.missions.some((x) => x.status === "done");
  const anyShort = m.missions.some((x) => x.status === "short");
  const card = "rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ink/10";
  const link = "w-full rounded-2xl px-4 py-1 text-left text-base text-ink-soft underline disabled:opacity-40";
  const chip = "rounded-full bg-paper px-2.5 py-1 text-base font-bold text-ink ring-1 ring-ink/15 disabled:opacity-40";

  // 様子のタブ: 1枚ずつ ‹ › で
  const views: React.ReactNode[] = [
    <section key="score" className={card}>
      <h2 className="font-bold">得点と雪HP</h2>
      <ul className="mt-1 text-lg">
        {TEAMS.map((t) => (
          <li key={t.id}>
            <span className="mr-1 inline-block size-3 rounded-full align-middle" style={{ background: t.color }} aria-hidden="true" />
            <b>{t.name}</b> {totals[t.id]} 点
          </li>
        ))}
        <li>
          {m.rollcall.snowName ? `「${m.rollcall.snowName}」` : "雪"}HP {hp.current}/{hp.max} ・ {prog.done}/{prog.total} 軒
          {prog.allDone && <b className="text-camellia-deep"> ・ 討伐{prog.defeatedAt ? ` ${prog.defeatedAt}` : ""}</b>}
        </li>
      </ul>
    </section>,
    <section key="map" className={`${card} space-y-2`}>
      <h2 className="font-bold">地図を開く（別の人として）</h2>
      <p className="text-base text-ink-soft">LINE でログインして登録した {lineCount} 人（と、デモの架空の人）には、予告・点呼・作戦が隊長トークに届きます。</p>
      <div className="flex flex-wrap gap-2">
        {helpers.slice(0, 9).map((h) => (
          <Link key={h.id} href={`/map?as=${h.id}`} className="rounded-full px-3 py-1 text-base font-bold text-white" style={{ background: TEAMS.find((t) => t.id === h.teamId)?.color }}>
            {name(h.id)}
          </Link>
        ))}
      </div>
    </section>,
  ];
  if (s.recap)
    views.push(
      <section key="recap" className={`${card} min-h-0 overflow-y-auto`}>
        <h2 className="font-bold">今朝の実況（{hasClaudeKey() ? "Claude" : "定型"}）</h2>
        <p className="mt-1 text-lg">{s.recap.text}</p>
      </section>,
    );
  if (s.answers.length > 0)
    views.push(
      <section key="answers" className={`${card} min-h-0 overflow-y-auto`}>
        <h2 className="font-bold">点呼の答え（{s.answers.length} 件）</h2>
        <p className="mt-1 text-base">
          {s.answers.map((a) => `${name(a.participantId)}: ${String(a.answer) === "yes" ? "はい" : String(a.answer) === "no" ? "いいえ" : a.answer === "together" ? "一緒なら" : `${a.answer}分`}`).join(" ・ ")}
        </p>
      </section>,
    );
  if (s.briefing)
    views.push(
      <section key="briefing" className={`${card} min-h-0 overflow-y-auto`}>
        <h2 className="font-bold">{status === "announced" ? "前夜の予告" : "エリアへのまとめ"}</h2>
        <p className="mt-1 text-base">{names.mask(s.briefing)}</p>
      </section>,
    );
  if (s.weekly)
    views.push(
      <section key="weekly" className={`${card} min-h-0 overflow-y-auto`}>
        <h2 className="font-bold">今週の群れ（{s.weekly.weekStart} の週）</h2>
        <p className="mt-1 text-base">{s.weekly.commentary}</p>
        <p className="mt-1 text-base">
          {s.weekly.ranking.map((t, i) => `${i + 1}位 ${TEAMS.find((x) => x.id === t)?.name} ${s.weekly!.teamTotals[t]}点`).join(" ・ ")}
        </p>
        {s.weekly.titles.length > 0 && (
          <p className="mt-1 text-sm">称号: {s.weekly.titles.map((t) => `${names.mask(t.nickname)}「${t.title}」${t.rareCard ? "（レア確定）" : ""}`).join("、")}</p>
        )}
      </section>,
    );
  for (const msg of s.messages.slice(0, 6))
    views.push(
      <section key={`msg-${msg.participantId}`} className={`${card} min-h-0 overflow-y-auto`}>
        <h2 className="font-bold">隊長トークに届く文面（{name(msg.participantId)}さんへ）</h2>
        <p className="mt-1 rounded-2xl bg-ice-soft px-3 py-2 text-base">{names.mask(msg.text)}</p>
      </section>,
    );

  // 家ごとのタブ: 大事な順に2軒ずつ
  const missions = [...m.missions]
    .sort((a, b) => b.importance - a.importance)
    .map((x) => {
      const base = roster.bases.find((b) => b.id === x.baseId);
      const going = m.sorties.filter((so) => so.missionId === x.id);
      const help = helpState(s, x.id);
      const photo = going.find((so) => so.photoCheck)?.photoCheck?.evidence;
      return (
        <section key={x.id} className={`${card} text-base`}>
          <p className="text-lg">
            拠点{base?.number ?? "?"}：<b>{MISSION_TEXT[x.status]}</b>（{going.length}/{x.requiredPeople}人）
          </p>
          <p className="text-ink-soft">
            {going.map((so) => name(so.participantId)).join("・")}
            {help.stage > 0 && <span className="text-alert"> ヘルプ {radiusLabel(help.stage - 1)}まで</span>}
            {help.knockIds && help.knockIds.length > 0 && " 声かけ依頼済み"}
          </p>
          {x.reason && <p className="line-clamp-2 text-sm text-ink-soft">司令官: {x.reason}</p>}
          {photo && <p className="line-clamp-2 text-sm text-ink-soft">写真（Claude）: {photo}</p>}
          {s.thanks?.[x.id] && <p className="line-clamp-2 text-sm text-camellia-deep">ありがとう「{s.thanks[x.id].label}」→ {s.thanks[x.id].sentence}</p>}
          {s.cheers?.[x.id] && s.cheers[x.id].length > 0 && <p className="text-sm text-ink-soft">家族の応援: {s.cheers[x.id].map((c) => `「${c.label}」`).join("")}</p>}
        </section>
      );
    });

  return (
    <Screen
      header={
        <header className="flex items-start justify-between gap-2 px-4 pt-3 pb-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">
              シマエナ<span className="text-camellia-deep">GO</span> デモ操作
            </h1>
            <p className="truncate text-base">
              {m.rollcall.date} ・ <b className="tabular-nums">{clockText(s.clockMin)}</b> ・ <b>{ROLLCALL_TEXT[status]}</b>
              {m.rollcall.snowName && <> ・ 「{m.rollcall.snowName}」</>}
            </p>
          </div>
          <Link href="/admin/settings" className="shrink-0 rounded-full bg-ink px-3 py-2 text-base font-bold text-white">
            管理
          </Link>
        </header>
      }
    >
      <Pager
        tabs={[
          { key: "flow", label: "流れ" },
          { key: "more", label: "ほか" },
          { key: "view", label: "様子" },
          { key: "houses", label: "家" },
          { key: "ops", label: "運営", badge: problems.length + (db.kind !== "none" && db.kind !== "ready" ? 1 : 0) },
          { key: "voice", label: "声", badge: voices.length + feedbackOpen },
        ]}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <Step n="0" label="前夜の予告（12cm）" action={startEmptyMorning} />
          <Step n="1" label="6:30 積もった → 雪かき待ち・作戦・近所に通知" action={ringNow} disabled={status !== "announced"} />
          <Step n="2" label="（なくてよい）架空の人が手伝える時間を答える" action={answerRandomly} disabled={status !== "open"} />
          <Step n="3" label="6:40 司令官の作戦" action={runCommander} disabled={status !== "open" || s.answers.length === 0} />
          <Step
            n="4"
            label="1軒、完了にする"
            action={completeOne}
            disabled={status !== "planned" || !m.missions.some((x) => x.status === "assigned" || x.status === "in_progress" || x.status === "short")}
          />
          <AutoComplete
            run={completeOneAuto}
            disabled={status !== "planned" || !m.missions.some((x) => x.status === "assigned" || x.status === "in_progress" || x.status === "short")}
          />
          <Step n="5" label="人手不足の家へ駆けつけ" action={rescue} disabled={!anyShort} />
          <Step n="5b" label="まだ降っている → もう一度" action={reopenDemo} disabled={status !== "planned" || !anyDone} />
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <PresentationMode
            actions={{
              announce: startEmptyMorning,
              ring: ringNow,
              goA: presentGo.bind(null, "a"),
              goB: presentGo.bind(null, "b"),
              allTeams: presentAllTeams,
              gather: presentGather,
              completeOther: completeOneAuto,
              finishA: presentFinish,
              cheer: presentCheer,
            }}
          />
          <Step n="6" label="日曜の夜: 今週の群れ" action={runWeekly} />
          <form action={makeBookNow}>
            <button className={link}>今週の絵本を作る（文と絵: Claude）→ /book</button>
          </form>
          <form action={announceByForecast}>
            <button className={link}>本当の天気（Open-Meteo）で予告を判断</button>
          </form>
          <form action={helpNextRing}>
            <button disabled={!anyShort} className={link}>
              ヘルプ通知を次の輪へ（300m→1km）
            </button>
          </form>
          <section className={`${card} space-y-1`}>
            <p className="text-base text-ink-soft">最後に終わった家の代わりに押す</p>
            <form action={thanksDemo} className="flex flex-wrap items-center gap-1">
              <span className="text-base font-bold">依頼者</span>
              {(["1", "2", "3"] as const).map((c) => (
                <button key={c} name="choice" value={c} disabled={!anyDone} className={chip}>
                  {THANKS_CHOICES[c]}
                </button>
              ))}
            </form>
            <form action={cheerDemo} className="flex flex-wrap items-center gap-1">
              <span className="text-base font-bold">家族</span>
              {(["1", "2", "3"] as const).map((c) => (
                <button key={c} name="choice" value={c} disabled={!anyDone} className={chip}>
                  {CHEER_CHOICES[c]}
                </button>
              ))}
            </form>
          </section>
          <form action={writeRecapNow}>
            <button disabled={status !== "planned"} className={link}>
              今朝の実況を書く
            </button>
          </form>
          <form action={writeShareTextsNow}>
            <button className={link}>SNS の投稿文を書く（Claude）</button>
          </form>
          <form action={nudgeNow}>
            <button className={link}>隊長の声かけ（しばらく来ていない人へ）</button>
          </form>
          {demoEnabled() && (
            <form action={backToSample}>
              <button className={link}>7:10 の見本の状態に戻す</button>
            </form>
          )}
          <form action="/api/cards/try" method="get">
            <button className={link}>カードの試し描き（今日の話題・Claude の挿絵）</button>
          </form>
          <form action={remakeSnowSong}>
            <button className={link}>今朝の雪の歌を作り直す（Claude が作曲）</button>
          </form>
          <form action={seedRoadReportsDemo}>
            <button className={link}>道の報告をデモで2件入れる（つるつる・道が細い）</button>
          </form>
          <form action={seedKikigakiDemo}>
            <button className={link}>デモの聞き書きを1件入れる（次に終わる家・届ける）</button>
          </form>
        </div>
        <PagedNodes nodes={views} label="様子" />
        <PagedNodes nodes={missions} per={2} label="ミッション" empty={<p className="text-lg">まだミッションはありません（「流れ」の 3 で作戦を立てると出ます）。</p>} />
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {db.kind !== "none" && db.kind !== "ready" && (
            <section className="space-y-2 rounded-2xl bg-warm p-4 shadow-sm ring-1 ring-ink/10">
              <p className="text-base">
                <b>Neon の準備がまだです</b>
                {db.kind === "unprepared" && <span className="text-sm text-ink-soft">（足りない表: {db.missing.join("・")}）</span>}
                {db.kind === "error" && <span className="text-sm text-alert">（接続エラー: {db.message}）</span>}
              </p>
              <form action={prepareDatabase}>
                <button className="w-full rounded-2xl bg-ink px-4 py-3 text-lg font-bold text-white">DB を準備する（何度でも安全）</button>
              </form>
            </section>
          )}
          {problems.length > 0 && (
            <section className={`${card} space-y-1 ring-2 ring-alert`} aria-label="問題">
              <h2 className="font-bold text-alert">問題（{problems.length} 件・新しい順）</h2>
              <ul className="text-sm">
                {problems.slice(0, 3).map((x, i) => (
                  <li key={i} className="line-clamp-2">
                    <span className="tabular-nums text-ink-soft">{new Date(x.at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</span> <b>{x.where}</b> {names.mask(x.message)}
                  </li>
                ))}
              </ul>
              <form action={clearProblemsAction}>
                <button className="text-base text-ink-soft underline">記録を空にする</button>
              </form>
            </section>
          )}
          <section className={`${card} min-h-0 flex-1 overflow-hidden text-sm`}>
            <h2 className="text-base font-bold">記録（新しい5件）</h2>
            <ol className="mt-1 space-y-0.5">
              {s.log.slice(-5).reverse().map((line, i) => (
                <li key={i} className="line-clamp-2">
                  {names.mask(line)}
                </li>
              ))}
            </ol>
          </section>
          <p className="text-sm text-ink-soft">
            隊長: {hasClaudeKey() ? "Claude" : "モック"} ・ 保存: {STORAGE_TEXT(db)} ・ LINE ログイン: {hasLoginKeys() ? "設定済み" : "未設定"} ・ 今月の文面 {notices} 件
          </p>
          <div className="flex items-center justify-between">
            <Link href="/admin/settings" className="text-base font-bold underline">
              管理者ダッシュボード（設定・警報・鍵）
            </Link>
            {gate === "ok" && (
              <form action={logoutAction}>
                <button className="text-base text-ink-soft underline">ログアウト</button>
              </form>
            )}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <section className={`${card} space-y-1`} aria-label="今週の声">
            <h2 className="font-bold">今週の声（{voices.length} 件）</h2>
            <p className="text-sm">
              {(Object.keys(VOICE_LABEL) as (keyof typeof VOICE_LABEL)[]).map((k) => `${VOICE_LABEL[k]} ${voiceCounts[k]}`).join(" ・ ")}
            </p>
            <p className="text-sm text-ink-soft">相談から Claude が読み取った「求められていること」の要約だけ（原文・名前は残しません）。</p>
          </section>
          {/* 報告箱（spec v1.33）: 町の人の「隊長に伝える」。AI（点検ループ）が直して閉じる */}
          <section className={`${card} space-y-1`} aria-label="報告箱">
            <h2 className="font-bold">
              報告箱（確かめ中 {feedbackOpen} 件）<span className="text-sm font-normal text-ink-soft"> ・ Issue: {hasGithubToken() ? "その場で" : "Actions が1時間ごとに"}</span>
            </h2>
            {feedback.length === 0 ? (
              <p className="text-sm text-ink-soft">まだありません。隊長トークの封筒のボタンか設定の「要望・バグ報告」から届きます。</p>
            ) : (
              <ul className="space-y-0.5 text-sm">
                {feedback.slice(0, 3).map((f) => (
                  <li key={f.id} className="line-clamp-2">
                    {KIND_MARK[f.triagedKind ?? f.kind]} <b>{STATUS_LABEL[f.status]}</b> {f.summary ?? f.text}
                    {f.issueUrl && (
                      <>
                        {" "}
                        <a href={f.issueUrl} target="_blank" rel="noopener" className="underline">
                          #{f.issueNumber}
                        </a>
                      </>
                    )}
                    <span className="text-ink-soft">（{KIND_LABEL[f.kind]}・{f.page}）</span>
                  </li>
                ))}
              </ul>
            )}
            <form action={syncFeedbackNow}>
              <button className={link}>GitHub を見て、直った報告を本人に知らせる</button>
            </form>
          </section>
          <PagedNodes
            nodes={[...voices].reverse().map((v) => (
              <p key={v.id} className="rounded-2xl bg-card px-3 py-2 text-sm ring-1 ring-ink/10">
                <b>{VOICE_LABEL[v.category]}</b> {v.summary}
                {v.motives.length > 0 && <span className="text-ink-soft">（{v.motives.map((m) => MOTIVE_LABEL[m]).join("・")}）</span>}
              </p>
            ))}
            per={3}
            label="声"
            empty={<p className="text-sm text-ink-soft">今週はまだ声がありません。隊長トークで相談があると、ここにたまります。</p>}
          />
          <section className={`${card} space-y-1`} aria-label="改善の提案">
            <h2 className="font-bold">
              改善の提案{improvement ? `（${improvement.from}〜${improvement.to}・${improvement.byClaude ? "Claude" : "定型"}）` : ""}
            </h2>
            {improvement && improvement.proposals.length > 0 ? (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {improvement.proposals.slice(0, 3).map((p, i) => (
                  <li key={i}>
                    <b>{p.title}</b>（{p.voices} 件・{p.priority}）: {p.change} <span className="text-ink-soft">→ {p.where}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-ink-soft">まだありません。日曜の夜に自動で書きます（下のボタンでも）。採用は本人が決めます。</p>
            )}
            <form action={writeImprovementsNow}>
              <button className={link}>今週の提案を書く（Claude）</button>
            </form>
          </section>
        </div>
      </Pager>
    </Screen>
  );
}

export default function AdminPage({ searchParams }: { searchParams: Promise<{ login?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <AdminContent searchParams={searchParams} />
    </Suspense>
  );
}
