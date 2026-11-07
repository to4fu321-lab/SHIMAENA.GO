"use server";

// 声のありがとう（spec v1.29）: 家の人が吹き込んだ声を保存して、手伝った人に届ける。
// 「自分」は trustedViewer で確かめる（画面の申告は信じない）。
// 離れて暮らす家族（11/7 本人の指示）: ログインの印（家族の代わりに登録した人の cookie）で、その家に紐づいた家族かを確かめる。
// デモ（架空の人）では、その家の人の画面から「家族として」吹き込める（撮影用。DEMO_MODE が off なら使えない）。
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { PENDING_COOKIE, readPending } from "@/lib/auth/pending";
import { applyVoiceThanks, familyVoiceRequester, voiceThanksTarget } from "@/lib/morning/ops";
import { familyVoiceId } from "@/lib/thanks/voice";
import { isDemoViewer, trustedViewer } from "@/lib/viewer";

export interface VoiceResult {
  ok: boolean;
  text: string;
}

/** だれの声として受け付けるか。家の人なら { requesterId }、家族なら { requesterId, family: true }。確かめられなければ undefined */
async function whoRecords(viewerIdIn: string, missionId: string, family: boolean): Promise<{ requesterId: string; family: boolean } | undefined> {
  const viewerId = viewerIdIn ? await trustedViewer(viewerIdIn) : null;
  if (!family) return viewerId ? { requesterId: viewerId, family: false } : undefined;
  // デモ: 架空の家の人の画面から、家族として
  if (viewerId && isDemoViewer(viewerId)) return (await voiceThanksTarget(missionId, viewerId)) ? { requesterId: viewerId, family: true } : undefined;
  // 本物: 家族の代わりに登録した人（参加者ではない）。その家に紐づいているときだけ
  const pending = readPending((await cookies()).get(PENDING_COOKIE)?.value);
  const requesterId = pending ? await familyVoiceRequester(missionId, pending.lineUserId) : undefined;
  return requesterId ? { requesterId, family: true } : undefined;
}

export async function sendVoiceThanksAction(formData: FormData): Promise<VoiceResult> {
  const missionId = String(formData.get("missionId") ?? "");
  const family = formData.get("family") === "1";
  const who = await whoRecords(String(formData.get("viewerId") ?? ""), missionId, family);
  if (!who) return { ok: false, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };
  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) return { ok: false, text: "録音が見つかりませんでした。もう一度吹き込んでください。" };
  const seconds = Number(formData.get("seconds") ?? 0);
  const r = await applyVoiceThanks(
    missionId,
    who.requesterId,
    {
      bytes: new Uint8Array(await file.arrayBuffer()),
      mime: file.type || "audio/webm",
      seconds: Number.isFinite(seconds) ? seconds : 0,
    },
    new Date(),
    { family: who.family },
  );
  revalidatePath(`/thanks/${missionId}`);
  if (who.family) revalidatePath(`/thanks/${familyVoiceId(missionId)}`);
  return { ok: r.ok, text: r.text };
}
