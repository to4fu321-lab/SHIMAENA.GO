import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { adminGate } from "@/lib/admin-auth";
import { hasClaudeKey } from "@/lib/claude/client";
import { dbStatus } from "@/lib/db";
import { demoEnabled } from "@/lib/env";
import { countOutSince } from "@/lib/inbox/store";
import { hasLoginKeys } from "@/lib/auth/line-login";
import { hasPushKeys } from "@/lib/push/keys";
import { countSubscriptions } from "@/lib/push/store";
import { monthStartIso } from "@/lib/jst";
import { THRESHOLD_RANGE, loadSettings } from "@/lib/ops/settings";
import { manualStop, stormStatus } from "@/lib/storm";
import { saveSettingsAction, stormToggleSettingsAction } from "./actions";

export const metadata: Metadata = { title: "管理者ダッシュボード ・ シマエナGO" };

// 基本1画面（390×844）に収めるため、2つのタブに分ける（spec v1.17: LINE のメニューはなくなった）
const TABS = { settings: "設定", status: "状態" } as const;
type Tab = keyof typeof TABS;

/** 鍵があるかだけを見せる（中身は出さない） */
const KEYS: { env: string; label: string }[] = [
  { env: "ANTHROPIC_API_KEY", label: "Claude" },
  { env: "DATABASE_URL", label: "Neon" },
  { env: "LINE_LOGIN_CHANNEL_ID", label: "LINE ログイン ID" },
  { env: "LINE_LOGIN_CHANNEL_SECRET", label: "LINE ログイン秘密" },
  { env: "AUTH_SECRET", label: "署名の鍵" },
  { env: "VAPID_PRIVATE_KEY", label: "通知の鍵" },
  { env: "ADMIN_PASSWORD", label: "合言葉" },
  { env: "CRON_SECRET", label: "cron の鍵" },
];

const bigButton = "w-full rounded-2xl bg-ink px-4 py-3 text-lg font-bold text-white";
const box = "space-y-2 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ink/10";

async function SettingsTab() {
  const [settings, storm, manualStorm] = await Promise.all([loadSettings(), stormStatus(), manualStop()]);
  return (
    <>
      <form action={saveSettingsAction} className={box}>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="linePaused" defaultChecked={settings.linePaused} className="size-6 shrink-0" />
          <span>
            <b>通知を一時停止</b>
            <span className="block text-sm text-ink-soft">端末への通知を止める（隊長トークには残る）</span>
          </span>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <b>予告の基準</b>
            <span className="block text-sm text-ink-soft">朝6時までの雪がこれ以上</span>
          </span>
          <span className="shrink-0">
            <input
              type="number"
              name="snowThresholdCm"
              min={THRESHOLD_RANGE.min}
              max={THRESHOLD_RANGE.max}
              defaultValue={settings.snowThresholdCm}
              inputMode="numeric"
              className="w-20 rounded-2xl bg-paper px-3 py-2 text-lg ring-1 ring-ink/20"
            />{" "}
            cm
          </span>
        </label>
        <button className={bigButton}>保存する</button>
      </form>
      <section className={box}>
        <h2 className="font-bold">警報の日のお休み</h2>
        <p className="text-base">
          {storm.stopped ? `⛔ お休み中（${storm.source === "jma" ? `気象庁: ${storm.names.join("・")}` : "手動"}）` : "ふつうに動いています（警報の間は自動で止まります）"}
        </p>
        <form action={stormToggleSettingsAction}>
          <input type="hidden" name="on" value={manualStorm ? "0" : "1"} />
          <button className={bigButton}>{manualStorm ? "手動のお休みをやめる" : "手動でお休みにする"}</button>
        </form>
      </section>
    </>
  );
}

async function StatusTab() {
  const [db, notices, subs] = await Promise.all([dbStatus(), countOutSince(monthStartIso()).catch(() => 0), countSubscriptions().catch(() => ({ devices: 0, people: 0 }))]);
  return (
    <>
      <section className={box}>
        <h2 className="font-bold">ログインと通知（spec v1.17）</h2>
        <ul className="text-base">
          <li>
            LINE ログイン: <b>{hasLoginKeys() ? "設定済み" : "未設定（docs/login-setup.md）"}</b>
          </li>
          <li>
            端末への通知（Web Push）: <b>{hasPushKeys() ? "設定済み" : "未設定（隊長トークにたまるだけ）"}</b> ・ オンにした人 <b className="tabular-nums">{subs.people}</b> 人（{subs.devices} 台）
          </li>
          <li>
            今月、隊長トークに届けた文面: <b className="tabular-nums">{notices}</b> 件（上限なし）
          </li>
        </ul>
      </section>
      <section className={box}>
        <h2 className="font-bold">鍵（中身は出しません）</h2>
        <ul className="grid grid-cols-2 gap-x-3 text-base">
          {KEYS.map((k) => (
            <li key={k.env} className="truncate">
              {process.env[k.env] ? "✅" : "⬜"} {k.label}
            </li>
          ))}
        </ul>
        <p className="text-base">
          DB: <b>{db.kind === "ready" ? `OK（${db.participants} 人）` : db.kind === "none" ? "メモリ" : db.kind === "unprepared" ? "未準備" : "エラー"}</b> ・ 隊長:{" "}
          <b>{hasClaudeKey() ? "Claude" : "モック"}</b> ・ デモ操作: <b>{demoEnabled() ? "オン" : "オフ"}</b>
        </p>
        <p className="text-sm text-ink-soft">鍵は Vercel の環境変数で入れます。</p>
      </section>
    </>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<{ done?: string; tab?: string }> }) {
  await connection();
  const gate = await adminGate();
  if (gate === "login" || gate === "unconfigured") redirect("/admin");
  const { done, tab: rawTab } = await searchParams;
  const tab: Tab = rawTab && rawTab in TABS ? (rawTab as Tab) : "settings";

  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-2 bg-paper px-4 py-3 text-lg text-ink">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">管理者ダッシュボード</h1>
        <Link href="/admin" className="shrink-0 text-base text-ink-soft underline">
          デモ操作
        </Link>
      </header>
      <nav className="grid grid-cols-2 gap-1 rounded-2xl bg-card p-1 ring-1 ring-ink/10" aria-label="タブ">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <Link
            key={t}
            href={`/admin/settings?tab=${t}`}
            aria-current={t === tab ? "page" : undefined}
            className={`rounded-xl py-2 text-center font-bold ${t === tab ? "bg-ink text-white" : "text-ink"}`}
          >
            {TABS[t]}
          </Link>
        ))}
      </nav>
      {done && (
        <p role="status" className="rounded-2xl bg-ice-soft px-4 py-2 text-base font-bold">
          {done}
        </p>
      )}
      {tab === "settings" ? <SettingsTab /> : <StatusTab />}
    </main>
  );
}

export default function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ done?: string; tab?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}
