"use server";

import { revalidatePath } from "next/cache";
import { applySchema, seedTown } from "@/lib/db";
import { issueCardsForMission } from "@/lib/cards/issue";
import { DEMO_DATE, completeNext, fillAnswers, rescueShort, type MorningRecord } from "@/lib/morning/flow";
import { setupRichMenu } from "@/lib/line/richmenu";
import { isThanksChoice } from "@/lib/claude/thanks";
import { latestClear } from "@/lib/morning/clear";
import { announce, applyThanks, checkForecastAndAnnounce, escalateHelpIfDue, notifyHelp, plan, ring, weeklyRecap, writeRecap } from "@/lib/morning/ops";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning, resetToSample, saveMorning } from "@/lib/morning/store";
import { progress } from "@/lib/morning/view";

function refresh() {
  revalidatePath("/");
  revalidatePath("/map");
  revalidatePath("/admin");
}

/** 読む → 書き換える → 保存する、をひとまとめに */
async function update(change: (s: MorningRecord) => void | Promise<void>) {
  const s = await loadMorning();
  await change(s);
  await saveMorning(s);
  refresh();
}

/** 0: デモの日付で予告（予報 12cm）。LINE のある人には予告が届く */
export async function startEmptyMorning() {
  await announce({ date: DEMO_DATE, forecastCm: 12 });
  refresh();
}

/** 0': 本当の天気を見て、基準（5cm）を超えていれば明朝の予告を出す */
export async function announceByForecast() {
  try {
    await checkForecastAndAnnounce(); // 予告の有無はどちらも記録に残る
  } catch (e) {
    await update((s) => void s.log.push(`天気の取得に失敗: ${e instanceof Error ? e.message : String(e)}`));
    return;
  }
  refresh();
}

export async function ringNow() {
  await ring();
  refresh();
}

export async function answerRandomly() {
  const roster = await loadRoster();
  await update((s) => fillAnswers(s, roster, Date.now() % 100000));
}

export async function runCommander() {
  await plan();
  refresh();
}

/** 4: そろった家を1軒、完了にする（デモ）。カードも発行して、LINE のある人には届く。全軒終わったら今朝の実況 */
export async function completeOne() {
  const roster = await loadRoster();
  let allDone = false;
  await update(async (s) => {
    const missionId = completeNext(s, roster);
    const mission = s.morning.missions.find((m) => m.id === missionId);
    if (!mission) return;
    const sorties = s.morning.sorties.filter((x) => x.missionId === mission.id);
    try {
      const issued = await issueCardsForMission(s, roster, mission, sorties);
      s.firstFlights = [...new Set([...(s.firstFlights ?? []), ...issued.firstFlightIds])];
    } catch (e) {
      s.log.push(`カードの発行に失敗: ${e instanceof Error ? e.message : String(e)}`);
    }
    allDone = progress(s.morning).allDone;
  });
  if (allDone) await writeRecapNow();
}

/** ありがとう点呼を、いちばん最近に終わった家の依頼者の代わりに押す（デモ用。本番は依頼者の LINE のボタン） */
export async function thanksDemo(formData: FormData) {
  const choice = String(formData.get("choice") ?? "1");
  if (!isThanksChoice(choice)) return;
  const s = await loadMorning();
  const roster = await loadRoster();
  const latest = latestClear(s.morning, roster);
  if (!latest) return;
  await applyThanks(latest.missionId, choice);
  refresh();
}

/** 今朝の実況を書く（Claude。キーがなければ定型）。全軒完了では自動で呼ばれる */
export async function writeRecapNow() {
  try {
    await writeRecap();
  } catch (e) {
    await update((s) => void s.log.push(`今朝の実況に失敗: ${e instanceof Error ? e.message : String(e)}`));
    return;
  }
  refresh();
}

export async function rescue() {
  const roster = await loadRoster();
  await update((s) => void rescueShort(s, roster));
}

/** 人手不足の家のヘルプ通知を次の輪へ（300m → 600m → 1km → サポーター）。5分待たずに進める */
export async function helpNextRing() {
  const s = await loadMorning();
  let n = 0;
  for (const m of s.morning.missions) if (m.status === "short" && (await notifyHelp(m.id)) !== null) n++;
  if (n === 0) await escalateHelpIfDue();
  refresh();
}

/** 日曜の「今週の群れ」: 実況・称号・週の目標・翌週のシャッフル */
export async function runWeekly() {
  try {
    await weeklyRecap();
  } catch (e) {
    await update((s) => void s.log.push(`今週のまとめに失敗: ${e instanceof Error ? e.message : String(e)}`));
    return;
  }
  refresh();
}

/** LINE のリッチメニューを作って全員の既定にする（画像は SVG から） */
export async function makeRichMenu() {
  try {
    const r = await setupRichMenu();
    await update((s) => void s.log.push(r.richMenuId ? `リッチメニューを作成（${r.richMenuId}）` : "リッチメニュー: LINE の鍵がないので画像だけ作成"));
  } catch (e) {
    await update((s) => void s.log.push(`リッチメニューの作成に失敗: ${e instanceof Error ? e.message : String(e)}`));
  }
}

export async function backToSample() {
  await resetToSample();
  refresh();
}

export async function setViewer(formData: FormData) {
  const id = String(formData.get("viewerId") ?? "");
  if (/^h\d+$/.test(id)) await update((s) => void (s.morning.viewerId = id));
}

/** Neon に表を作り、架空の町内データを入れる（何度押しても安全） */
export async function prepareDatabase() {
  const statements = await applySchema();
  const seeded = await seedTown();
  await update((s) => {
    s.log.push(`DB を準備しました（SQL ${statements} 文・参加者 ${seeded.participants} 人・拠点 ${seeded.bases} 軒）`);
  });
}
