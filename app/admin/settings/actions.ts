"use server";
// 管理者ダッシュボード /admin/settings の操作。どれも合言葉のログインを確かめてから動かす。
// 結果は ?done=… で画面に返す（1行の知らせ）。
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin-auth";
import { deleteRichMenu, setupRichMenu } from "@/lib/line/richmenu";
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

function done(message: string, tab: "menu" | "settings"): never {
  revalidatePath(PAGE);
  revalidatePath("/admin");
  redirect(`${PAGE}?tab=${tab}&done=${encodeURIComponent(message)}`);
}

/** リッチメニューを作り直して全員の既定にする（古い同名メニューは消える） */
export async function updateRichMenuAction() {
  await requireAdmin();
  let msg: string;
  try {
    const r = await setupRichMenu((await loadSettings()).chatBarText);
    msg = r.richMenuId ? `リッチメニューを更新しました（${r.richMenuId}）` : "LINE の鍵がないので、画像を作るところまで確かめました";
  } catch (e) {
    msg = `リッチメニューの更新に失敗: ${e instanceof Error ? e.message : String(e)}`;
  }
  await log(msg);
  done(msg, "menu");
}

/** 使っていないリッチメニューを1つ消す（既定のものは消せない） */
export async function deleteRichMenuAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("richMenuId") ?? "");
  let msg: string;
  try {
    msg = (await deleteRichMenu(id)) ? `リッチメニューを消しました（${id}）` : "消せませんでした（使用中か、見つかりません）";
  } catch (e) {
    msg = `リッチメニューを消せませんでした: ${e instanceof Error ? e.message : String(e)}`;
  }
  await log(msg);
  done(msg, "menu");
}

/** 動きの設定を保存する */
export async function saveSettingsAction(formData: FormData) {
  await requireAdmin();
  const before = await loadSettings();
  const after = await saveSettings({
    linePaused: formData.get("linePaused") === "on",
    snowThresholdCm: Number(formData.get("snowThresholdCm")),
    chatBarText: String(formData.get("chatBarText") ?? ""),
  });
  const changes: string[] = [];
  if (before.linePaused !== after.linePaused) changes.push(after.linePaused ? "LINE の送信を一時停止" : "LINE の送信を再開");
  if (before.snowThresholdCm !== after.snowThresholdCm) changes.push(`予告の基準 ${before.snowThresholdCm}→${after.snowThresholdCm}cm`);
  if (before.chatBarText !== after.chatBarText) changes.push(`メニューの下の文字「${after.chatBarText}」（反映は「リッチメニューを更新」で）`);
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
