"use server";

import { ensureTeam } from "@/lib/member";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { sniffImageType } from "@/lib/image";
import type { TextMessage } from "@/lib/line/types";
import type { ClearSummary } from "@/lib/morning/clear";
import { completeManually, completeWithPhoto, joinMission, joinNearby, reportShort, resolveViewerByLiff, setGoing } from "@/lib/morning/ops";
import { signViewer, trustedViewer, VIEWER_COOKIE } from "@/lib/viewer";
import { withStateLock } from "@/lib/ops/lock";

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
    if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。LINE から地図を開いてください。" };
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
    if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。LINE から地図を開いてください。" };
    const messages = await joinMission(id, missionId);
    revalidatePath("/map");
    return { ok: true, text: firstText(messages) };
  });
}

/** 「10分だけ参加」: 近くの足りない家か、作業中の家の偵察・補給に加わる */
export async function fiveMinutesAction(viewerId: string): Promise<ActionResult> {
  return withStateLock("map:fiveMinutesAction", async () => {
    const id = await trustedViewer(viewerId);
    if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。LINE から地図を開いてください。" };
    const r = await joinNearby(id, 10);
    revalidatePath("/map");
    return { ok: r.joined, text: firstText(r.messages) };
  });
}

/** 完了写真（画面で縮小した JPEG）を受け取り、Claude が確認して完了にする */
export async function finishAction(formData: FormData): Promise<ActionResult> {
  return withStateLock("map:finishAction", async () => {
    const id = await trustedViewer(String(formData.get("viewerId") ?? ""));
    if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。" };
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) return { ok: false, text: "写真を選んでください。" };
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mediaType = sniffImageType(bytes);
    if (!mediaType) return { ok: false, text: "JPEG・PNG・WebP の写真を送ってください。" };
    const r = await completeWithPhoto(id, { bytes, mediaType });
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

/** LIFF でログインした人を、この画面の「自分」にする */
export async function signInWithLiff(accessToken: string): Promise<{ ok: boolean; nickname?: string }> {
  const found = await resolveViewerByLiff(accessToken);
  if (!found) return { ok: false };
  // 前に登録したお願いする側の人も、アプリを開いたらチームに入る（spec v1.10）
  const p = await ensureTeam(found).catch(() => found);
  (await cookies()).set(VIEWER_COOKIE, signViewer(p.id), {
    httpOnly: true,
    sameSite: "none", // LINE の中のブラウザから開くため
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return { ok: true, nickname: p.nickname };
}
