import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { hasClaudeKey } from "@/lib/claude/client";
import { hasLineKeys } from "@/lib/line/client";
import { clockText } from "@/lib/demo/flow";
import { dbStatus, type DbStatus } from "@/lib/db";
import { loadDemo } from "@/lib/demo/store";
import { snowHp, teamTotals } from "@/lib/morning";
import { TEAMS } from "@/lib/teams";
import { TOWN } from "@/lib/town";
import { answerRandomly, backToSample, completeOne, prepareDatabase, rescue, ring, runCommander, startEmptyMorning } from "./actions";

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
        className="flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left text-lg font-bold text-ink shadow-sm ring-1 ring-ink/10 disabled:opacity-40"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-sm text-white">{n}</span>
        {label}
      </button>
    </form>
  );
}

async function AdminContent() {
  await connection();
  const [s, db] = await Promise.all([loadDemo(), dbStatus()]);
  const m = s.morning;
  const totals = teamTotals(m);
  const hp = snowHp(m);
  const name = (id: string) => TOWN.participants.find((p) => p.id === id)?.nickname ?? id;
  const helpers = TOWN.participants.filter((p) => p.role === "helper");
  const status = m.rollcall.status;

  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-5 bg-paper px-4 py-5 text-ink">
      <header>
        <p className="text-sm text-ink/60">デモ操作（審査・撮影用）</p>
        <h1 className="text-2xl font-bold">
          シマエナ<span className="text-neon">GO</span> の朝を動かす
        </h1>
        <p className="mt-1 text-base">
          {m.rollcall.date} ・ 時計 <b className="tabular-nums">{clockText(s.clockMin)}</b> ・ 点呼 <b>{ROLLCALL_TEXT[status]}</b>
        </p>
        <p className="text-sm text-ink/60">
          司令官: {hasClaudeKey() ? "Claude（本物）" : "モック（API キー未設定）"} ・ 保存: {STORAGE_TEXT(db)} ・ LINE:{" "}
          {hasLineKeys() ? "設定済み" : "未設定"}
        </p>
      </header>

      {db.kind !== "none" && db.kind !== "ready" && (
        <section className="space-y-2 rounded-2xl bg-[#fff4d6] p-4 shadow-sm ring-1 ring-ink/10">
          <h2 className="font-bold">Neon の準備がまだです</h2>
          <p className="text-base">
            下のボタンで表を作り、架空の町内データ（参加者12人・拠点8軒）を入れます。何度押しても大丈夫です。
          </p>
          {db.kind === "unprepared" && <p className="text-sm text-ink/60">足りない表: {db.missing.join("・")}</p>}
          {db.kind === "error" && <p className="text-sm text-[#b00020]">接続エラー: {db.message}</p>}
          <form action={prepareDatabase}>
            <button className="w-full rounded-2xl bg-ink px-4 py-3 text-lg font-bold text-white">DB を準備する</button>
          </form>
        </section>
      )}

      <section className="space-y-2" aria-label="操作">
        <Step n="0" label="まっさらな朝にする（前夜の予告だけ）" action={startEmptyMorning} />
        <Step n="1" label="6:30 エナガ点呼を鳴らす" action={ring} disabled={status !== "announced"} />
        <Step n="2" label="みんなの回答を入れる（ランダム）" action={answerRandomly} disabled={status !== "open"} />
        <Step n="3" label="6:40 司令官に作戦を立ててもらう" action={runCommander} disabled={status !== "open" || s.answers.length === 0} />
        <Step n="4" label="そろった家を1軒、完了にする" action={completeOne} disabled={status !== "planned"} />
        <Step n="5" label="人手不足の家に駆けつける" action={rescue} disabled={!m.missions.some((x) => x.status === "short")} />
        <form action={backToSample}>
          <button className="w-full rounded-2xl px-4 py-2 text-sm text-ink/60 underline">朝 7:10 の見本の状態に戻す</button>
        </form>
      </section>

      <section className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/10">
        <h2 className="font-bold">地図を開く（3台のスマホで別の人として）</h2>
        <div className="flex flex-wrap gap-2">
          {helpers.slice(0, 6).map((h) => (
            <Link
              key={h.id}
              href={`/map?as=${h.id}`}
              className="rounded-full px-3 py-1 text-sm font-bold text-white"
              style={{ background: TEAMS.find((t) => t.id === h.teamId)?.color }}
            >
              {h.nickname}
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/10">
        <h2 className="font-bold">得点と雪HP</h2>
        <ul className="mt-1 text-base">
          {TEAMS.map((t) => (
            <li key={t.id}>
              <b style={{ color: t.color }}>{t.name}</b> {totals[t.id]} 点
            </li>
          ))}
          <li>今朝の雪HP {hp.current} / {hp.max}</li>
        </ul>
      </section>

      {s.briefing && (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/10">
          <h2 className="font-bold">町内へのまとめ</h2>
          <p className="mt-1">{s.briefing}</p>
        </section>
      )}

      {m.missions.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/10">
          <h2 className="font-bold">ミッション</h2>
          <ul className="mt-1 space-y-1 text-base">
            {[...m.missions]
              .sort((a, b) => b.importance - a.importance)
              .map((x) => {
                const base = TOWN.bases.find((b) => b.id === x.baseId)!;
                const going = m.sorties.filter((so) => so.missionId === x.id);
                return (
                  <li key={x.id}>
                    拠点{base.number}：<b>{MISSION_TEXT[x.status]}</b>（{going.length}/{x.requiredPeople}人）
                    <span className="text-sm text-ink/60"> {going.map((so) => name(so.participantId)).join("・")}</span>
                  </li>
                );
              })}
          </ul>
        </section>
      )}

      {s.messages.length > 0 && (
        <section className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/10">
          <h2 className="font-bold">LINE に届く文面（司令官が作成）</h2>
          <ul className="mt-2 space-y-2">
            {s.messages.slice(0, 6).map((msg) => (
              <li key={msg.participantId} className="rounded-2xl bg-[#e9fbe7] px-3 py-2 text-base">
                <span className="text-xs text-ink/60">{name(msg.participantId)}さんへ</span>
                <br />
                {msg.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-ink/10">
        <h2 className="font-bold">記録</h2>
        <ol className="mt-1 list-inside list-decimal">
          {s.log.slice(-8).map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ol>
      </section>
    </main>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <AdminContent />
    </Suspense>
  );
}
