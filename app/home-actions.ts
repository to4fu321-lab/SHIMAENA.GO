"use server";
// ホームの「応援する」「おつかれさま」と、応援を聞いたしるし（11/4）。応援は家の中からなので夜でも送れる。
import { revalidatePath } from "next/cache";
import { withStateLock } from "@/lib/ops/lock";
import { markCheersSeen, sendHomeCheer } from "@/lib/solo/cheer-ops";
import { trustedViewer } from "@/lib/viewer";
import { appNow } from "@/lib/clock";

export async function sendCheerAction(formData: FormData): Promise<{ ok: boolean; sent: number }> {
  return withStateLock("home:sendCheer", async () => {
    const id = await trustedViewer(String(formData.get("viewerId") ?? ""));
    const kind = formData.get("kind") === "thanks" ? "thanks" : "cheer";
    if (!id) return { ok: false, sent: 0 };
    const sent = await sendHomeCheer(id, kind, appNow());
    revalidatePath("/");
    return { ok: true, sent };
  });
}

export async function cheersSeenAction(formData: FormData): Promise<void> {
  await withStateLock("home:cheersSeen", async () => {
    const id = await trustedViewer(String(formData.get("viewerId") ?? ""));
    if (id) await markCheersSeen(id, appNow());
  });
}
