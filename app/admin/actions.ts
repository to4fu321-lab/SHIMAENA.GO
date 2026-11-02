"use server";

import { revalidatePath } from "next/cache";
import { planMorning } from "@/lib/claude/commander";
import { applyPlan, commanderInput, completeNext, emptyMorning, fillAnswers, rescueShort, ringRollcall } from "@/lib/demo/flow";
import { getDemo, resetToSample, setDemo } from "@/lib/demo/store";

function refresh() {
  revalidatePath("/map");
  revalidatePath("/admin");
}

export async function startEmptyMorning() {
  setDemo(emptyMorning(getDemo().morning.viewerId));
  refresh();
}

export async function ring() {
  ringRollcall(getDemo());
  refresh();
}

export async function answerRandomly() {
  fillAnswers(getDemo(), Date.now() % 100000);
  refresh();
}

export async function runCommander() {
  const s = getDemo();
  const plan = await planMorning(commanderInput(s));
  applyPlan(s, plan);
  refresh();
}

export async function completeOne() {
  completeNext(getDemo());
  refresh();
}

export async function rescue() {
  rescueShort(getDemo());
  refresh();
}

export async function backToSample() {
  resetToSample();
  refresh();
}

export async function setViewer(formData: FormData) {
  const id = String(formData.get("viewerId") ?? "");
  if (/^h\d+$/.test(id)) getDemo().morning.viewerId = id;
  refresh();
}
