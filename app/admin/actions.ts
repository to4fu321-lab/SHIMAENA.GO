"use server";

import { revalidatePath } from "next/cache";
import { planMorning } from "@/lib/claude/commander";
import { applySchema, seedTown } from "@/lib/db";
import { applyPlan, commanderInput, completeNext, emptyMorning, fillAnswers, rescueShort, ringRollcall } from "@/lib/demo/flow";
import type { DemoState } from "@/lib/demo/flow";
import { loadDemo, resetToSample, saveDemo } from "@/lib/demo/store";

function refresh() {
  revalidatePath("/map");
  revalidatePath("/admin");
}

/** 読む → 書き換える → 保存する、をひとまとめに */
async function update(change: (s: DemoState) => void | Promise<void>) {
  const s = await loadDemo();
  await change(s);
  await saveDemo(s);
  refresh();
}

export async function startEmptyMorning() {
  const s = await loadDemo();
  await saveDemo(emptyMorning(s.morning.viewerId));
  refresh();
}

export async function ring() {
  await update((s) => ringRollcall(s));
}

export async function answerRandomly() {
  await update((s) => fillAnswers(s, Date.now() % 100000));
}

export async function runCommander() {
  await update(async (s) => {
    const plan = await planMorning(commanderInput(s));
    applyPlan(s, plan);
  });
}

export async function completeOne() {
  await update((s) => void completeNext(s));
}

export async function rescue() {
  await update((s) => void rescueShort(s));
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
