"use server";

// 報告箱（spec v1.33）: 「隊長に伝える」の送信。画面の「自分」は trustedViewer で確かめる（cookie か、デモの架空の人）。
import { revalidatePath } from "next/cache";
import { submitFeedback } from "@/lib/feedback/ops";
import { isFeedbackKind, PICKABLE_KINDS } from "@/lib/feedback/rules";
import { inboxKeyOf } from "@/lib/inbox/key";
import { listThread, markRead } from "@/lib/inbox/store";
import { toBubbles, type ChatBubble } from "@/lib/inbox/view";
import { repo } from "@/lib/repo";
import { isDemoViewer, trustedViewer } from "@/lib/viewer";

export interface FeedbackResult {
  ok: boolean;
  text?: string;
  /** 隊長の返事（2文） */
  reply?: string[];
  /** 隊長トークの流れ（トークの画面から送ったとき、すぐ出すため） */
  bubbles?: ChatBubble[];
}

export async function sendFeedbackAction(viewerId: string, kind: string, text: string, page: string, withBubbles = false): Promise<FeedbackResult> {
  const id = await trustedViewer(viewerId);
  const p = id ? await repo().findParticipant(id) : undefined;
  const key = inboxKeyOf(p);
  if (!p || !key) return { ok: false, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };
  if (!isFeedbackKind(kind) || !PICKABLE_KINDS.includes(kind)) return { ok: false, text: "種類を選んでください。" };
  const r = await submitFeedback(p, { kind, text, page });
  if (!r.ok) return { ok: false, text: r.text };
  revalidatePath("/chat");
  if (!withBubbles) return { ok: true, reply: r.reply };
  await markRead(key);
  return { ok: true, reply: r.reply, bubbles: toBubbles(await listThread(key), isDemoViewer(viewerId) ? viewerId : undefined) };
}
