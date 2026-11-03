"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { sniffImageType } from "@/lib/image";
import type { TextMessage } from "@/lib/line/types";
import type { ClearSummary } from "@/lib/morning/clear";
import { completeWithPhoto, reportShort, resolveViewerByLiff, setGoing } from "@/lib/morning/ops";
import { isDemoViewer, readViewer, signViewer, VIEWER_COOKIE } from "@/lib/viewer";

export interface ActionResult {
  ok: boolean;
  text: string;
  /** 完了したときの MISSION CLEAR のまとめ */
  clear?: ClearSummary;
}

const firstText = (messages: { type: string }[]) => (messages[0] as TextMessage | undefined)?.text ?? "";

/** 画面が言う「自分」を信じてよいか: デモの架空の人か、cookie で確かめた本人だけ */
async function trustedViewer(viewerId: string): Promise<string | null> {
  if (isDemoViewer(viewerId)) return viewerId;
  const fromCookie = readViewer((await cookies()).get(VIEWER_COOKIE)?.value);
  return fromCookie === viewerId ? viewerId : null;
}

export async function goAction(viewerId: string): Promise<ActionResult> {
  const id = await trustedViewer(viewerId);
  if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。LINE から地図を開いてください。" };
  const messages = await setGoing(id, true);
  revalidatePath("/map");
  return { ok: true, text: firstText(messages) };
}

export async function shortAction(viewerId: string): Promise<ActionResult> {
  const id = await trustedViewer(viewerId);
  if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。" };
  const messages = await reportShort(id);
  revalidatePath("/map");
  return { ok: true, text: firstText(messages) };
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
  const r = await completeWithPhoto(id, { bytes, mediaType });
  revalidatePath("/map");
  return { ok: r.done, text: firstText(r.messages), clear: r.clear };
}

/** LIFF でログインした人を、この画面の「自分」にする */
export async function signInWithLiff(accessToken: string): Promise<{ ok: boolean; nickname?: string }> {
  const p = await resolveViewerByLiff(accessToken);
  if (!p) return { ok: false };
  (await cookies()).set(VIEWER_COOKIE, signViewer(p.id), {
    httpOnly: true,
    sameSite: "none", // LINE の中のブラウザから開くため
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });
  return { ok: true, nickname: p.nickname };
}
