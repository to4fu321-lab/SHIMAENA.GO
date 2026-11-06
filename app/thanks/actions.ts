"use server";

// 声のありがとう（spec v1.29）: 家の人が吹き込んだ声を保存して、手伝った人に届ける。
// 「自分」は trustedViewer で確かめる（画面の申告は信じない）。
import { revalidatePath } from "next/cache";
import { applyVoiceThanks } from "@/lib/morning/ops";
import { trustedViewer } from "@/lib/viewer";

export interface VoiceResult {
  ok: boolean;
  text: string;
}

export async function sendVoiceThanksAction(formData: FormData): Promise<VoiceResult> {
  const viewerId = await trustedViewer(String(formData.get("viewerId") ?? ""));
  if (!viewerId) return { ok: false, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };
  const missionId = String(formData.get("missionId") ?? "");
  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) return { ok: false, text: "録音が見つかりませんでした。もう一度吹き込んでください。" };
  const seconds = Number(formData.get("seconds") ?? 0);
  const r = await applyVoiceThanks(missionId, viewerId, {
    bytes: new Uint8Array(await file.arrayBuffer()),
    mime: file.type || "audio/webm",
    seconds: Number.isFinite(seconds) ? seconds : 0,
  });
  revalidatePath(`/thanks/${missionId}`);
  return { ok: r.ok, text: r.text };
}
