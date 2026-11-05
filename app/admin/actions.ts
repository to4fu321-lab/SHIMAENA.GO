"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { demoEnabled } from "@/lib/env";
import { withStateLock } from "@/lib/ops/lock";
import { clearProblems } from "@/lib/ops/problems";
import { applySchema, seedTown } from "@/lib/db";
import { issueCardsForMission } from "@/lib/cards/issue";
import { DEMO_DATE, completeNext, fillAnswers, rescueShort, type MorningRecord } from "@/lib/morning/flow";
import { isThanksChoice } from "@/lib/claude/thanks";
import { isCheerChoice } from "@/lib/morning/cheer";
import { latestClear } from "@/lib/morning/clear";
import {
  announce,
  applyCheer,
  applyThanks,
  checkForecastAndAnnounce,
  escalateHelpIfDue,
  notifyHelp,
  plan,
  reopenIfStillSnowing,
  ring,
  weeklyRecap,
  writeRecap,
} from "@/lib/morning/ops";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning, resetToSample, saveMorning } from "@/lib/morning/store";
import { progress } from "@/lib/morning/view";
import { appToday } from "@/lib/morning/today";
import { recordHouseFeathers } from "@/lib/solo/ops";
import { refreshShareTexts } from "@/lib/sns/refresh";

/** 管理の操作の入口: 合言葉のログインを確かめ、今朝の状態の鍵を取ってから動かす */
async function guarded<T>(label: string, fn: () => Promise<T>): Promise<T> {
  await requireAdmin();
  return withStateLock(`admin:${label}`, fn);
}

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
  return guarded("startEmptyMorning", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    refresh();
  });
}

/** 0': 本当の天気を見て、基準（5cm）を超えていれば明朝の予告を出す */
export async function announceByForecast() {
  return guarded("announceByForecast", async () => {
    try {
      await checkForecastAndAnnounce(); // 予告の有無はどちらも記録に残る
    } catch (e) {
      await update((s) => void s.log.push(`天気の取得に失敗: ${e instanceof Error ? e.message : String(e)}`));
      return;
    }
    refresh();
  });
}

export async function ringNow() {
  return guarded("ringNow", async () => {
    await ring();
    refresh();
  });
}

export async function answerRandomly() {
  return guarded("answerRandomly", async () => {
    const roster = await loadRoster();
    await update((s) => fillAnswers(s, roster, Date.now() % 100000));
  });
}

export async function runCommander() {
  return guarded("runCommander", async () => {
    await plan();
    refresh();
  });
}

/** 降り続く日（v1.8 デモ）: 天気を見ずに、終わった家をもう一度開く（2回目・3回目） */
export async function reopenDemo() {
  return guarded("reopenDemo", async () => {
    await reopenIfStillSnowing(new Date(), { force: true });
    refresh();
  });
}

/** 4: そろった家を1軒、完了にする（デモ）。カードも発行して、LINE のある人には届く。全軒終わったら今朝の実況 */
export async function completeOne() {
  return guarded("completeOne", async () => {
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
      // 来た人の個人の記録（羽）。チーム得点は completeNext のまま
      const base = roster.bases.find((b) => b.id === mission.baseId);
      const requester = base && roster.participants.find((p) => p.id === base.requesterId);
      const people = sorties.flatMap((x) => roster.participants.filter((p) => p.id === x.participantId));
      const now = new Date();
      await recordHouseFeathers(people, { missionId: mission.id, baseLocation: requester?.location, today: appToday(s, now), now });
      allDone = progress(s.morning).allDone;
    });
    if (allDone) await writeRecapNow();
    else await refreshShareTexts().catch((e) => console.error("[share]", e));
  });
}

/** SNS の投稿文を Claude に書いてもらう（数字が変わっていなくても作り直す）。キーがなければ定型のまま */
export async function writeShareTextsNow() {
  return guarded("writeShareTextsNow", async () => {
    try {
      const n = await refreshShareTexts(new Date(), { force: true });
      await update((s) => void s.log.push(n > 0 ? `SNS の投稿文を Claude が ${n} 種類書いた` : "SNS の投稿文: Claude のキーがないので定型のまま"));
    } catch (e) {
      await update((s) => void s.log.push(`SNS の投稿文に失敗: ${e instanceof Error ? e.message : String(e)}`));
    }
    revalidatePath("/public/town");
  });
}

/** ありがとう点呼を、いちばん最近に終わった家の依頼者の代わりに押す（デモ用。本番は依頼者の LINE のボタン） */
export async function thanksDemo(formData: FormData) {
  return guarded("thanksDemo", async () => {
    const choice = String(formData.get("choice") ?? "1");
    if (!isThanksChoice(choice)) return;
    const s = await loadMorning();
    const roster = await loadRoster();
    const latest = latestClear(s.morning, roster);
    if (!latest) return;
    await applyThanks(latest.missionId, choice);
    refresh();
  });
}

/** 家族の応援スタンプを、いちばん最近に終わった家の家族の代わりに押す（デモ用。本番は家族の LINE のボタン） */
export async function cheerDemo(formData: FormData) {
  return guarded("cheerDemo", async () => {
    const choice = String(formData.get("choice") ?? "1");
    if (!isCheerChoice(choice)) return;
    const s = await loadMorning();
    const roster = await loadRoster();
    const latest = latestClear(s.morning, roster);
    if (!latest) return;
    await applyCheer(latest.missionId, choice);
    refresh();
  });
}

/** 今朝の実況を書く（Claude。キーがなければ定型）。全軒完了では自動で呼ばれる */
export async function writeRecapNow() {
  return guarded("writeRecapNow", async () => {
    try {
      await writeRecap();
    } catch (e) {
      await update((s) => void s.log.push(`今朝の実況に失敗: ${e instanceof Error ? e.message : String(e)}`));
      return;
    }
    refresh();
  });
}

export async function rescue() {
  return guarded("rescue", async () => {
    const roster = await loadRoster();
    await update((s) => void rescueShort(s, roster));
  });
}

/** 人手不足の家のヘルプ通知を次の輪へ（300m → 600m → 1km → サポーター）。5分待たずに進める */
export async function helpNextRing() {
  return guarded("helpNextRing", async () => {
    const s = await loadMorning();
    let n = 0;
    for (const m of s.morning.missions) if (m.status === "short" && (await notifyHelp(m.id)) !== null) n++;
    if (n === 0) await escalateHelpIfDue();
    refresh();
  });
}

/** 日曜の「今週の群れ」: 実況・称号・週の目標・翌週のシャッフル */
export async function runWeekly() {
  return guarded("runWeekly", async () => {
    try {
      await weeklyRecap();
    } catch (e) {
      await update((s) => void s.log.push(`今週のまとめに失敗: ${e instanceof Error ? e.message : String(e)}`));
      return;
    }
    refresh();
  });
}

export async function backToSample() {
  return guarded("backToSample", async () => {
    if (!demoEnabled()) return; // 本当に町内で使っているときは、見本の状態に戻さない
    await resetToSample();
    refresh();
  });
}

export async function setViewer(formData: FormData) {
  return guarded("setViewer", async () => {
    const id = String(formData.get("viewerId") ?? "");
    if (/^h\d+$/.test(id)) await update((s) => void (s.morning.viewerId = id));
  });
}

/** Neon に表を作り、架空の町内データを入れる（何度押しても安全） */
export async function prepareDatabase() {
  return guarded("prepareDatabase", async () => {
    const statements = await applySchema();
    const seeded = await seedTown();
    await update((s) => {
      s.log.push(`DB を準備しました（SQL ${statements} 文・参加者 ${seeded.participants} 人・拠点 ${seeded.bases} 軒）`);
    });
  });
}

/** /admin の「問題」の記録を空にする */
export async function clearProblemsAction() {
  return guarded("clearProblems", async () => {
    await clearProblems();
    revalidatePath("/admin");
  });
}
