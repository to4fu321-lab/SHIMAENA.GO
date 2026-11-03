"use server";

import { revalidatePath } from "next/cache";
import { applySchema, seedTown } from "@/lib/db";
import { issueCardsForMission } from "@/lib/cards/issue";
import { DEMO_DATE, completeNext, fillAnswers, rescueShort, type MorningRecord } from "@/lib/morning/flow";
import { announce, checkForecastAndAnnounce, plan, ring } from "@/lib/morning/ops";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning, resetToSample, saveMorning } from "@/lib/morning/store";

function refresh() {
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

/** 4: そろった家を1軒、完了にする（デモ）。カードも発行して、LINE のある人には届く */
export async function completeOne() {
  const roster = await loadRoster();
  await update(async (s) => {
    const missionId = completeNext(s, roster);
    const mission = s.morning.missions.find((m) => m.id === missionId);
    if (!mission) return;
    const sorties = s.morning.sorties.filter((x) => x.missionId === mission.id);
    try {
      await issueCardsForMission(s, roster, mission, sorties);
    } catch (e) {
      s.log.push(`カードの発行に失敗: ${e instanceof Error ? e.message : String(e)}`);
    }
  });
}

export async function rescue() {
  const roster = await loadRoster();
  await update((s) => void rescueShort(s, roster));
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
