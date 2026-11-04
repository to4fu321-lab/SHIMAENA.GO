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
import { hasLineKeys } from "@/lib/line/client";
import { RICH_MENU_NAME, menuItems, richMenuStatus, richMenuSvg } from "@/lib/line/richmenu";
import { readLineUsage } from "@/lib/ops/line-usage";
import { CHAT_BAR_MAX, THRESHOLD_RANGE, loadSettings } from "@/lib/ops/settings";
import { manualStop, stormStatus } from "@/lib/storm";
import { deleteRichMenuAction, saveSettingsAction, stormToggleSettingsAction, updateRichMenuAction } from "./actions";

export const metadata: Metadata = { title: "管理者ダッシュボード ・ シマエナGO" };

/** 鍵があるかだけを見せる（中身は出さない） */
const KEYS: { env: string; label: string }[] = [
  { env: "ANTHROPIC_API_KEY", label: "Claude（シマエナ隊長）" },
  { env: "DATABASE_URL", label: "データベース（Neon）" },
  { env: "LINE_CHANNEL_SECRET", label: "LINE のチャネルシークレット" },
  { env: "LINE_CHANNEL_ACCESS_TOKEN", label: "LINE のアクセストークン" },
  { env: "NEXT_PUBLIC_LIFF_ID", label: "LIFF ID（LINE の中で開く画面）" },
  { env: "NEXT_PUBLIC_LINE_ADD_FRIEND_URL", label: "友だち追加の URL" },
  { env: "ADMIN_PASSWORD", label: "管理画面の合言葉" },
  { env: "CRON_SECRET", label: "定時の処理（cron）の鍵" },
];

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-ink/10">
      <h2 className="text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

const bigButton = "w-full rounded-2xl bg-ink px-4 py-3 text-lg font-bold text-white";

async function Dashboard({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  await connection();
  const gate = await adminGate();
  if (gate === "login" || gate === "unconfigured") redirect("/admin");
  const { done } = await searchParams;

  const [settings, db, usage, storm, manualStorm, line, menus] = await Promise.all([
    loadSettings(),
    dbStatus(),
    readLineUsage(),
    stormStatus(),
    manualStop(),
    lineAdminInfo().catch(() => null),
    richMenuStatus().catch((e: unknown) => (e instanceof Error ? e.message : String(e))),
  ]);
  const preview = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(richMenuSvg())}`;
  const items = menuItems();

  return (
    <main className="mx-auto min-h-dvh max-w-xl space-y-5 bg-paper px-4 py-5 text-lg text-ink">
      <header className="space-y-1">
        <Link href="/admin" className="text-base text-ink-soft underline">
          ← デモ操作にもどる
        </Link>
        <h1 className="text-2xl font-bold">管理者ダッシュボード</h1>
        <p className="text-base text-ink-soft">LINE のメニューと、アプリの動きの設定。押した操作は /admin の「記録」にも残ります。</p>
      </header>

      {done && (
        <p role="status" className="rounded-2xl bg-ice-soft px-4 py-3 text-base font-bold">
          {done}
        </p>
      )}

      <Card title="リッチメニュー（LINE のトーク画面の下）">
        {/* eslint-disable-next-line @next/next/no-img-element -- その場で作る SVG の見本なので next/image は使わない */}
        <img src={preview} alt="リッチメニューの見本" className="w-full rounded-xl ring-1 ring-ink/10" />
        <ul className="space-y-1 text-base">
          {items.map((it) => (
            <li key={it.key}>
              <b>{it.label}</b> → {it.action.type === "uri" ? "画面を開く" : `「${it.action.text}」と送る`}
            </li>
          ))}
          <li className="text-ink-soft">閉じたときの文字: 「{settings.chatBarText}」</li>
        </ul>
        <form action={updateRichMenuAction}>
          <button className={bigButton}>リッチメニューを更新する</button>
        </form>
        <p className="text-base text-ink-soft">いまの見本で作り直し、全員の既定にします。古い「{RICH_MENU_NAME}」は消えます。何度押しても大丈夫。</p>

        <h3 className="pt-2 font-bold">LINE に登録されているメニュー</h3>
        {menus === null ? (
          <p className="text-base text-ink-soft">LINE のアクセストークンがないので見られません。</p>
        ) : typeof menus === "string" ? (
          <p className="text-base text-alert">読めませんでした: {menus}</p>
        ) : menus.menus.length === 0 ? (
          <p className="text-base">まだありません。上のボタンで作ってください。</p>
        ) : (
          <ul className="space-y-2">
            {menus.menus.map((m) => (
              <li key={m.richMenuId} className="rounded-xl bg-paper p-3 text-base ring-1 ring-ink/10">
                <p>
                  <b>{m.name}</b> {m.isDefault && <span className="rounded-full bg-ink px-2 py-0.5 text-sm text-white">全員に表示中</span>}
                </p>
                <p className="text-sm break-all text-ink-soft">
                  {m.richMenuId} ・ 「{m.chatBarText}」 ・ ボタン {m.areas} 個
                </p>
                {!m.isDefault && (
                  <form action={deleteRichMenuAction} className="pt-1">
                    <input type="hidden" name="richMenuId" value={m.richMenuId} />
                    <button className="text-base text-alert underline">このメニューを消す</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card title="動きの設定">
        <form action={saveSettingsAction} className="space-y-4">
          <label className="flex items-start gap-3">
            <input type="checkbox" name="linePaused" defaultChecked={settings.linePaused} className="mt-1 size-6 shrink-0" />
            <span>
              <b>LINE の送信を一時停止する</b>
              <span className="block text-base text-ink-soft">予告・点呼などを送らずに記録だけ（通数を使わない確認用）。返信も止まります。</span>
            </span>
          </label>
          <label className="block">
            <b>前夜の予告を出す基準（cm）</b>
            <span className="block text-base text-ink-soft">
              21時に天気を見て、翌朝6時までの雪がこれ以上なら予告します（{THRESHOLD_RANGE.min}〜{THRESHOLD_RANGE.max}cm）。
            </span>
            <input
              type="number"
              name="snowThresholdCm"
              min={THRESHOLD_RANGE.min}
              max={THRESHOLD_RANGE.max}
              defaultValue={settings.snowThresholdCm}
              inputMode="numeric"
              className="mt-1 w-32 rounded-2xl bg-paper px-4 py-3 text-lg ring-1 ring-ink/20"
            />
          </label>
          <label className="block">
            <b>メニューを閉じたときの文字</b>
            <span className="block text-base text-ink-soft">{CHAT_BAR_MAX}字まで。保存したあと「リッチメニューを更新する」で LINE に反映。</span>
            <input
              type="text"
              name="chatBarText"
              maxLength={CHAT_BAR_MAX}
              defaultValue={settings.chatBarText}
              className="mt-1 w-full rounded-2xl bg-paper px-4 py-3 text-lg ring-1 ring-ink/20"
            />
          </label>
          <button className={bigButton}>設定を保存する</button>
        </form>
      </Card>

      <Card title="警報の日のお休み">
        <p>{storm.stopped ? `⛔ お休み中（${storm.source === "jma" ? `気象庁: ${storm.names.join("・")}` : "手動"}）` : "ふつうに動いています"}</p>
        <form action={stormToggleSettingsAction}>
          <input type="hidden" name="on" value={manualStorm ? "0" : "1"} />
          <button className={bigButton}>{manualStorm ? "手動のお休みをやめる" : "手動でお休みにする"}</button>
        </form>
        <p className="text-base text-ink-soft">気象庁の警報が出ている間は、こちらに関係なく止まります。</p>
      </Card>

      <Card title="LINE の状態">
        {line === null ? (
          <p className="text-base text-ink-soft">LINE のアクセストークンがないので見られません。</p>
        ) : (
          <ul className="space-y-1 text-base">
            <li>公式アカウント: <b>{line.botName ?? "（取得できず）"}</b></li>
            <li>
              今月の送信（LINE の実数）: <b className="tabular-nums">{line.used ?? "?"}</b> / {line.quota === "none" ? "上限なし" : (line.quota ?? "?")} 通
            </li>
            <li>
              Webhook:{" "}
              {line.webhook ? (
                <>
                  <b>{line.webhook.active ? "オン" : "オフ"}</b> <span className="break-all text-ink-soft">{line.webhook.endpoint}</span>
                </>
              ) : (
                "（取得できず）"
              )}
            </li>
          </ul>
        )}
        <p className="text-base text-ink-soft">
          このアプリで数えた今月（{usage.month}）: 送信 {usage.sent} 通 ・ 送らずに記録 {usage.dryRun} 通
        </p>
      </Card>

      <Card title="鍵とつながり">
        <ul className="space-y-1 text-base">
          {KEYS.map((k) => (
            <li key={k.env}>
              {process.env[k.env] ? "✅" : "⬜"} {k.label} <span className="text-sm text-ink-soft">{k.env}</span>
            </li>
          ))}
        </ul>
        <p className="text-base">
          データベース: <b>{db.kind === "ready" ? `準備OK（参加者 ${db.participants} 人）` : db.kind === "none" ? "なし（メモリ保存）" : db.kind === "unprepared" ? "未準備（/admin で準備）" : "接続エラー"}</b>
          <br />
          Claude: <b>{hasClaudeKey() ? "本物" : "モック"}</b> ・ LINE: <b>{hasLineKeys() ? "設定済み" : "未設定"}</b>
          <br />
          デモ操作: <b>{demoEnabled() ? "オン" : "オフ"}</b> ・ LINE_DRY_RUN: <b>{lineDryRun() ? "オン" : "オフ"}</b>
        </p>
        <p className="text-base text-ink-soft">鍵は Vercel の環境変数で入れます（この画面には中身を出しません）。</p>
      </Card>
    </main>
  );
}

export default function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <Dashboard searchParams={searchParams} />
    </Suspense>
  );
}
