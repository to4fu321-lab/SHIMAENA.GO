"use server";

// 端末への通知（Web Push）の購読を保存・解除する（spec v1.17）。誰の端末かは cookie の本人（またはデモの架空の人）で決める。
// 家族の代わりに登録した人（参加者ではない）も、登録前の印（cookie）の LINE のアカウント ID で受け取れる。
import { cookies, headers } from "next/headers";
import { PENDING_COOKIE, readPending } from "@/lib/auth/pending";
import { inboxKeyOf } from "@/lib/inbox/key";
import { isSubscriptionJson, removeSubscription, saveSubscription } from "@/lib/push/store";
import { repo } from "@/lib/repo";
import { trustedViewer } from "@/lib/viewer";

/** この人の隊長トークの鍵（参加者、または家族の代わりに登録した人） */
export async function inboxKeyForViewer(viewerId: string): Promise<string | undefined> {
  const id = viewerId ? await trustedViewer(viewerId) : null;
  if (id) {
    const key = inboxKeyOf(await repo().findParticipant(id));
    if (key) return key;
  }
  const pending = readPending((await cookies()).get(PENDING_COOKIE)?.value);
  if (pending && (await repo().listFamilyLinksByFamily(pending.lineUserId)).length > 0) return pending.lineUserId;
  return undefined;
}

export async function savePushSubscriptionAction(viewerId: string, sub: unknown): Promise<{ ok: boolean; text?: string }> {
  const key = await inboxKeyForViewer(viewerId);
  if (!key) return { ok: false, text: "この画面の持ち主を確かめられませんでした。" };
  if (!isSubscriptionJson(sub)) return { ok: false, text: "通知の登録の形が読めませんでした。" };
  try {
    await saveSubscription(key, sub, (await headers()).get("user-agent") ?? undefined);
    return { ok: true };
  } catch (e) {
    console.error("[push] 保存できませんでした:", e instanceof Error ? e.message : e);
    return { ok: false, text: "通知の登録を保存できませんでした。" };
  }
}

export async function removePushSubscriptionAction(viewerId: string, endpoint: string): Promise<{ ok: boolean }> {
  const key = await inboxKeyForViewer(viewerId);
  if (!key || typeof endpoint !== "string") return { ok: false };
  await removeSubscription(endpoint).catch(() => undefined);
  return { ok: true };
}
