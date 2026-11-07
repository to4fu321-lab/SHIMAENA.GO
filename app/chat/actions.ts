"use server";

// 隊長トーク（spec v1.17）の操作。画面の「自分」は trustedViewer で確かめる（cookie か、デモの架空の人）。
// ことば（spec v1.36）: 返す流れは選んだことば（cookie）に訳す。本人が打った文は日本語に直してから今までの処理へ。
import { revalidatePath } from "next/cache";
import { takeChatQuota, type ChatKind } from "@/lib/chat/quota";
import { sendToCaptain, type ChatInput } from "@/lib/chat/send";
import { withMockClaude } from "@/lib/claude/client";
import { localizeBubbles } from "@/lib/i18n/bubbles";
import { currentLang } from "@/lib/i18n/cookie";
import { toJapanese } from "@/lib/i18n/translate";
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

/** 文と写真は Claude を呼ぶので、1人1日の上限（lib/chat/quota.ts）を超えたらモック応答で答える（公開中のお金の守り） */
async function sendWithQuota(p: NonNullable<Awaited<ReturnType<typeof me>>>, kind: ChatKind, input: ChatInput): Promise<void> {
  const run = () => sendToCaptain(p, input);
  if (await takeChatQuota(p.id, kind)) await run();
  else await withMockClaude(run);
}

/** いまの流れを読み直す（返事が入ったあと）。選んだことばに訳して返す */
async function refreshed(viewerId: string, key: string): Promise<ChatBubble[]> {
  const as = isDemoViewer(viewerId) ? viewerId : undefined;
  await markRead(key);
  return localizeBubbles(toBubbles(await listThread(key), as), await currentLang());
}

/**
 * 文を送る。opts.shown は自分の吹き出しに残す文字（ボタンの訳など）。shown があれば text は日本語（ボタンの中身）なので訳さない。
 * なければ本人が打った文: 日本語以外を選んでいれば日本語に直してから処理する（打った文そのものを自分の吹き出しに残す）
 */
export async function chatTextAction(viewerId: string, text: string, opts: { shown?: string } = {}): Promise<ChatResult> {
  const p = await me(viewerId);
  if (!p) return { ok: false, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };
  let input: ChatInput = { kind: "text", text, shown: opts.shown };
  if (!opts.shown) {
    const lang = await currentLang();
    if (lang !== "ja") {
      const ja = await toJapanese(text, lang);
      if (ja !== text) input = { kind: "text", text: ja, shown: text };
    }
  }
  await sendWithQuota(p, "text", input);
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
  await sendWithQuota(p, "photo", { kind: "photo", bytes, mediaType });
  revalidatePath("/chat");
  return { ok: true, bubbles: await refreshed(viewerId, inboxKeyOf(p)!) };
}

/** 新しい文面が届いていないか見る（数秒ごと） */
export async function chatPollAction(viewerId: string): Promise<ChatResult> {
  const p = await me(viewerId);
  if (!p) return { ok: false };
  return { ok: true, bubbles: await refreshed(viewerId, inboxKeyOf(p)!) };
}
