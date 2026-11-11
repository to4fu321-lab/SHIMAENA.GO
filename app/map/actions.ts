"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { adminGate } from "@/lib/admin-auth";
import { sniffImageType } from "@/lib/image";
import type { TextMessage } from "@/lib/line/types";
import type { ClearSummary } from "@/lib/morning/clear";
import { completeManually, completeWithPhoto, joinMission, precheckPhoto, joinNearby, reportShort, setGoing } from "@/lib/morning/ops";
import { trustedViewer } from "@/lib/viewer";
import { withStateLock } from "@/lib/ops/lock";
import { stormStopText } from "@/lib/storm";

export interface ActionResult {
  ok: boolean;
  text: string;
  /** 完了したときの MISSION CLEAR のまとめ */
  clear?: ClearSummary;
  /** 写真では「まだ」だった → 「それでも完了にする」を出せる */
  canManual?: boolean;
}

/** LINE の返事を画面の1行に: 吹き出しは1つ1つの話題なので、最初の2つ（何が起きたか・次にすること）をつなげて出す */
const firstText = (messages: { type: string }[]) =>
  messages
    .filter((m): m is TextMessage => m.type === "text")
    .slice(0, 2)
    .map((m) => m.text.replace(/\n/g, " "))
    .join(" ");

export async function goAction(viewerId: string): Promise<ActionResult> {
  return withStateLock("map:goAction", async () => {
    const id = await trustedViewer(viewerId);
    if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };
    const stop = await stormStopText();
    if (stop) return { ok: false, text: stop };
    const messages = await setGoing(id, true);
    revalidatePath("/map");
    return { ok: true, text: firstText(messages) };
  });
}

export async function shortAction(viewerId: string): Promise<ActionResult> {
  return withStateLock("map:shortAction", async () => {
    const id = await trustedViewer(viewerId);
    if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。" };
    const messages = await reportShort(id);
    revalidatePath("/map");
    return { ok: true, text: firstText(messages) };
  });
}

/** 「10分だけ助けに行く」: 人手が足りない家に加わる */
export async function joinAction(viewerId: string, missionId: string): Promise<ActionResult> {
  return withStateLock("map:joinAction", async () => {
    const id = await trustedViewer(viewerId);
    if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };
    const stop = await stormStopText();
    if (stop) return { ok: false, text: stop };
    const messages = await joinMission(id, missionId);
    revalidatePath("/map");
    return { ok: true, text: firstText(messages) };
  });
}

/** 「10分だけ参加」: 近くの足りない家か、作業中の家の偵察・補給に加わる */
export async function fiveMinutesAction(viewerId: string): Promise<ActionResult> {
  return withStateLock("map:fiveMinutesAction", async () => {
    const id = await trustedViewer(viewerId);
    if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };
    const stop = await stormStopText();
    if (stop) return { ok: false, text: stop };
    const r = await joinNearby(id, 10);
    revalidatePath("/map");
    return { ok: r.joined, text: firstText(r.messages) };
  });
}

/** 完了写真（画面で縮小した JPEG）を受け取り、Claude が確認して完了にする */
export async function finishAction(formData: FormData): Promise<ActionResult> {
  const id = await trustedViewer(String(formData.get("viewerId") ?? ""));
  if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。" };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, text: "写真を選んでください。" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImageType(bytes);
  if (!mediaType) return { ok: false, text: "JPEG・PNG・WebP の写真を送ってください。" };
  // 撮影ステージ（/admin/stage）から: 合言葉でログインした人の画面で、撮影の印があるときだけ、写真を Claude に送らず決まった確認で進める
  const stage = (await cookies()).get("shimaena_stage")?.value === "1" && ["ok", "open"].includes(await adminGate());
  // 写真の確認（Claude・30〜60秒）は鍵の外で先に。待つあいだも、ほかの人の「行く」などが止まらない
  if (!stage) await precheckPhoto(id, { bytes, mediaType });
  return withStateLock("map:finishAction", async () => {
    const r = await completeWithPhoto(id, { bytes, mediaType }, new Date(), { fast: stage });
    revalidatePath("/map");
    return { ok: r.done, text: firstText(r.messages), clear: r.clear, canManual: r.retry };
  });
}

/** 「それでも完了にする」: 写真なしで本人の報告として完了にする */
export async function manualFinishAction(viewerId: string): Promise<ActionResult> {
  return withStateLock("map:manualFinishAction", async () => {
    const id = await trustedViewer(viewerId);
    if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。" };
    const r = await completeManually(id);
    revalidatePath("/map");
    return { ok: r.done, text: firstText(r.messages), clear: r.clear };
  });
}
