"use server";
// 管理者ダッシュボード /admin/settings の操作。どれも合言葉のログインを確かめてから動かす。
// 結果は ?done=… で画面に返す（1行の知らせ）。
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { withStateLock } from "@/lib/ops/lock";
import { loadSettings, saveSettings } from "@/lib/ops/settings";
import { loadMorning, saveMorning } from "@/lib/morning/store";

const PAGE = "/admin/settings";

/** /admin の「記録」にも残す */
async function log(line: string) {
  await withStateLock("admin:settings-log", async () => {
    const s = await loadMorning();
    s.log.push(line);
    await saveMorning(s);
  });
}

function done(message: string, tab: "settings"): never {
  revalidatePath(PAGE);
  revalidatePath("/admin");
  redirect(`${PAGE}?tab=${tab}&done=${encodeURIComponent(message)}`);
}

/** 動きの設定を保存する */
export async function saveSettingsAction(formData: FormData) {
  await requireAdmin();
  const before = await loadSettings();
  const after = await saveSettings({
    linePaused: formData.get("linePaused") === "on",
    snowThresholdCm: Number(formData.get("snowThresholdCm")),
  });
  const changes: string[] = [];
  if (before.linePaused !== after.linePaused) changes.push(after.linePaused ? "通知を一時停止" : "通知を再開");
  if (before.snowThresholdCm !== after.snowThresholdCm) changes.push(`予告の基準 ${before.snowThresholdCm}→${after.snowThresholdCm}cm`);
  const msg = changes.length ? `設定を保存: ${changes.join("・")}` : "設定は変わっていません";
  if (changes.length) await log(msg);
  done(msg, "settings");
}

/** 警報の日のお休み（手動）の切りかえ */
export async function stormToggleSettingsAction(formData: FormData) {
  await requireAdmin();
  const { setManualStop } = await import("@/lib/storm");
  const on = formData.get("on") === "1";
  await setManualStop(on);
  revalidatePath("/");
  const msg = on ? "手動でお休みにしました" : "手動のお休みをやめました";
  await log(msg);
  done(msg, "settings");
}
