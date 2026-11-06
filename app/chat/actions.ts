"use server";

// 隊長トーク（spec v1.17）の操作。画面の「自分」は trustedViewer で確かめる（cookie か、デモの架空の人）。
import { revalidatePath } from "next/cache";
import { sendToCaptain } from "@/lib/chat/send";
import { sniffImageType } from "@/lib/image";
import { inboxKeyOf } from "@/lib/inbox/key";
import { listThread, markRead } from "@/lib/inbox/store";
import { toBubbles, type ChatBubble } from "@/lib/inbox/view";
import { repo } from "@/lib/repo";
import { isDemoViewer, trustedViewer } from "@/lib/viewer";

export interface ChatResult {
  ok: boolean;
  text?: string;
  bubbles?: ChatBubble[];
}

async function me(viewerId: string) {
  const id = await trustedViewer(viewerId);
  const p = id ? await repo().findParticipant(id) : undefined;
  return p && inboxKeyOf(p) ? p : undefined;
}

/** いまの流れを読み直す（返事が入ったあと） */
async function refreshed(viewerId: string, key: string): Promise<ChatBubble[]> {
  const as = isDemoViewer(viewerId) ? viewerId : undefined;
  await markRead(key);
  return toBubbles(await listThread(key), as);
}

export async function chatTextAction(viewerId: string, text: string): Promise<ChatResult> {
  const p = await me(viewerId);
  if (!p) return { ok: false, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };
  await sendToCaptain(p, { kind: "text", text });
  revalidatePath("/chat");
  return { ok: true, bubbles: await refreshed(viewerId, inboxKeyOf(p)!) };
}

export async function chatPostbackAction(viewerId: string, data: string, label?: string): Promise<ChatResult> {
  const p = await me(viewerId);
  if (!p) return { ok: false, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };
  if (!/^[\w:=\-.,]{1,120}$/.test(data)) return { ok: false, text: "このボタンは使えません。" };
  await sendToCaptain(p, { kind: "postback", data, label: label?.slice(0, 40) });
  revalidatePath("/chat");
  return { ok: true, bubbles: await refreshed(viewerId, inboxKeyOf(p)!) };
}

/** 写真（画面で縮めた JPEG）: 完了写真として受け取る */
export async function chatPhotoAction(formData: FormData): Promise<ChatResult> {
  const viewerId = String(formData.get("viewerId") ?? "");
  const p = await me(viewerId);
  if (!p) return { ok: false, text: "この画面の持ち主を確かめられませんでした。" };
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, text: "写真を選んでください。" };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mediaType = sniffImageType(bytes);
  if (!mediaType) return { ok: false, text: "JPEG・PNG・WebP の写真を送ってください。" };
  await sendToCaptain(p, { kind: "photo", bytes, mediaType });
  revalidatePath("/chat");
  return { ok: true, bubbles: await refreshed(viewerId, inboxKeyOf(p)!) };
}

/** 新しい文面が届いていないか見る（数秒ごと） */
export async function chatPollAction(viewerId: string): Promise<ChatResult> {
  const p = await me(viewerId);
  if (!p) return { ok: false };
  return { ok: true, bubbles: await refreshed(viewerId, inboxKeyOf(p)!) };
}
