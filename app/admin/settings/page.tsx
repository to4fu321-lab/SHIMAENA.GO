import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import { adminGate } from "@/lib/admin-auth";
import { hasClaudeKey } from "@/lib/claude/client";
import { dbStatus } from "@/lib/db";
import { demoEnabled, lineDryRun } from "@/lib/env";
import { lineAdminInfo } from "@/lib/line/admin-info";
import { RICH_MENU_NAME, richMenuStatus, richMenuSvg } from "@/lib/line/richmenu";
import { readLineUsage } from "@/lib/ops/line-usage";
import { CHAT_BAR_MAX, THRESHOLD_RANGE, loadSettings } from "@/lib/ops/settings";
import { manualStop, stormStatus } from "@/lib/storm";
import { deleteRichMenuAction, saveSettingsAction, stormToggleSettingsAction, updateRichMenuAction } from "./actions";

export const metadata: Metadata = { title: "管理者ダッシュボード ・ シマエナGO" };

// 基本1画面（390×844）に収めるため、3つのタブに分ける
const TABS = { menu: "メニュー", settings: "設定", status: "状態" } as const;
type Tab = keyof typeof TABS;

/** 鍵があるかだけを見せる（中身は出さない） */
const KEYS: { env: string; label: string }[] = [
  { env: "ANTHROPIC_API_KEY", label: "Claude" },
  { env: "DATABASE_URL", label: "Neon" },
  { env: "LINE_CHANNEL_SECRET", label: "LINE 秘密" },
  { env: "LINE_CHANNEL_ACCESS_TOKEN", label: "LINE トークン" },
  { env: "NEXT_PUBLIC_LIFF_ID", label: "LIFF ID" },
  { env: "NEXT_PUBLIC_LINE_ADD_FRIEND_URL", label: "友だち追加" },
  { env: "ADMIN_PASSWORD", label: "合言葉" },
  { env: "CRON_SECRET", label: "cron の鍵" },
];

const bigButton = "w-full rounded-2xl bg-ink px-4 py-3 text-lg font-bold text-white";
const box = "space-y-2 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ink/10";

async function MenuTab() {
  const menus = await richMenuStatus().catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
  const preview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(richMenuSvg())}`;
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- その場で作る SVG の見本なので next/image は使わない */}
      <img src={preview} alt="リッチメニューの見本（きょうの町・雪かきを頼む・町の地図・隊長に相談）" className="w-full rounded-xl ring-1 ring-ink/10" />
      <form action={updateRichMenuAction}>
        <button className={bigButton}>この見本でリッチメニューを更新</button>
      </form>
      <section className={box}>
        <h2 className="font-bold">LINE に登録中</h2>
        {menus === null ? (
          <p className="text-base text-ink-soft">LINE のトークンがないので見られません。</p>
        ) : typeof menus === "string" ? (
          <p className="text-base text-alert">読めませんでした: {menus.slice(0, 80)}</p>
        ) : menus.menus.length === 0 ? (
          <p className="text-base">まだありません。上のボタンで作れます。</p>
        ) : (
          <ul className="space-y-1">
            {menus.menus.slice(0, 3).map((m) => (
              <li key={m.richMenuId} className="flex items-center justify-between gap-2 text-base">
                <span className="min-w-0 truncate">
                  {m.isDefault ? "✅" : "・"} <b>{m.name}</b> <span className="text-ink-soft">…{m.richMenuId.slice(-6)}</span>
                </span>
                {m.isDefault ? (
                  <span className="shrink-0 text-sm text-ink-soft">表示中</span>
                ) : (
                  <form action={deleteRichMenuAction} className="shrink-0">
                    <input type="hidden" name="richMenuId" value={m.richMenuId} />
                    <button className="text-base text-alert underline">消す</button>
                  </form>
                )}
              </li>
            ))}
            {menus.menus.length > 3 && <li className="text-sm text-ink-soft">ほか {menus.menus.length - 3} 個（更新すると同名のものは消えます）</li>}
          </ul>
        )}
        <p className="text-sm text-ink-soft">更新すると全員のメニューになり、古い「{RICH_MENU_NAME}」は消えます。</p>
      </section>
    </>
  );
}

async function SettingsTab() {
  const [settings, storm, manualStorm] = await Promise.all([loadSettings(), stormStatus(), manualStop()]);
  return (
    <>
      <form action={saveSettingsAction} className={`${box} space-y-3`}>
        <label className="flex items-center gap-3">
          <input type="checkbox" name="linePaused" defaultChecked={settings.linePaused} className="size-6 shrink-0" />
          <span>
            <b>LINE 送信を一時停止</b>
            <span className="block text-sm text-ink-soft">送らずに記録だけ（返信も止まる）</span>
          </span>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>
            <b>予告の基準</b>
            <span className="block text-sm text-ink-soft">朝6時までの雪がこれ以上で予告</span>
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
        <label className="block">
          <b>メニューを閉じたときの文字</b>
          <span className="text-sm text-ink-soft">（{CHAT_BAR_MAX}字まで）</span>
          <input
            type="text"
            name="chatBarText"
            maxLength={CHAT_BAR_MAX}
            defaultValue={settings.chatBarText}
            className="mt-1 w-full rounded-2xl bg-paper px-4 py-2 text-lg ring-1 ring-ink/20"
          />
        </label>
        <button className={bigButton}>保存する</button>
      </form>
      <section className={box}>
        <h2 className="font-bold">警報の日のお休み</h2>
        <p className="text-base">
          {storm.stopped ? `⛔ お休み中（${storm.source === "jma" ? `気象庁: ${storm.names.join("・")}` : "手動"}）` : "ふつうに動いています"}
          <span className="block text-sm text-ink-soft">気象庁の警報の間は、自動で止まります。</span>
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
  const [db, usage, line] = await Promise.all([dbStatus(), readLineUsage(), lineAdminInfo().catch(() => null)]);
  return (
    <>
      <section className={box}>
        <h2 className="font-bold">LINE</h2>
        {line === null ? (
          <p className="text-base text-ink-soft">トークンがないので見られません。</p>
        ) : (
          <ul className="text-base">
            <li className="truncate">公式アカウント: <b>{line.botName ?? "?"}</b></li>
            <li>
              今月の送信: <b className="tabular-nums">{line.used ?? "?"}</b> / {line.quota === "none" ? "上限なし" : (line.quota ?? "?")} 通（LINE の実数）
            </li>
            <li className="truncate">
              Webhook: <b>{line.webhook ? (line.webhook.active ? "オン" : "オフ") : "?"}</b>{" "}
              <span className="text-sm text-ink-soft">{line.webhook?.endpoint.replace(/^https:\/\//, "")}</span>
            </li>
          </ul>
        )}
        <p className="text-sm text-ink-soft">
          アプリで数えた {usage.month}: 送信 {usage.sent} ・ 記録だけ {usage.dryRun}
        </p>
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
          <b>{hasClaudeKey() ? "Claude" : "モック"}</b>
          <br />
          デモ操作: <b>{demoEnabled() ? "オン" : "オフ"}</b> ・ DRY_RUN: <b>{lineDryRun() ? "オン" : "オフ"}</b>
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
  const tab: Tab = rawTab && rawTab in TABS ? (rawTab as Tab) : "menu";

  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-3 bg-paper px-4 py-4 text-lg text-ink">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">管理者ダッシュボード</h1>
        <Link href="/admin" className="shrink-0 text-base text-ink-soft underline">
          デモ操作
        </Link>
      </header>
      <nav className="grid grid-cols-3 gap-1 rounded-2xl bg-card p-1 ring-1 ring-ink/10" aria-label="タブ">
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
      {tab === "menu" ? <MenuTab /> : tab === "settings" ? <SettingsTab /> : <StatusTab />}
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
