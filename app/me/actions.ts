"use server";

// マイページ（spec v1.32）の操作。「自分」は trustedViewer で確かめる（LINE でログインした本人か、デモの架空の人だけ）。
// インタビューの答えは画面が持ち、整えるときに1回だけ送る。サーバーは答えの原文を残さない（整えたプロフィールだけ保存）。
import { revalidatePath } from "next/cache";
import { tidyProfile, type TidyProfile } from "@/lib/claude/profile";
import { answeredCount, normalizeProfileTurns, PROFILE_MIN_ANSWERS } from "@/lib/mypage/rules";
import { saveProfile, waveTo, type ProfileInput } from "@/lib/mypage/ops";
import type { MyProfile } from "@/lib/mypage/rules";
import { trustedViewer } from "@/lib/viewer";
import { appNow } from "@/lib/clock";

const noOwner = { ok: false as const, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };

export async function tidyProfileAction(viewerId: string, rawTurns: unknown): Promise<{ ok: boolean; text?: string; draft?: TidyProfile }> {
  const id = await trustedViewer(viewerId);
  if (!id) return noOwner;
  const turns = normalizeProfileTurns(rawTurns);
  if (answeredCount(turns) < PROFILE_MIN_ANSWERS) return { ok: false, text: "ひとつだけでも答えてもらえると、形にできます。" };
  try {
    return { ok: true, draft: await tidyProfile(turns) };
  } catch (e) {
    console.error("[mypage]", e instanceof Error ? e.message : e);
    return { ok: false, text: "うまくいきませんでした。電波のよい所で、もう一度押してください。" };
  }
}

export async function saveProfileAction(viewerId: string, input: ProfileInput): Promise<{ ok: boolean; text: string; profile?: MyProfile }> {
  const id = await trustedViewer(viewerId);
  if (!id) return noOwner;
  try {
    const r = await saveProfile(id, input, appNow());
    revalidatePath("/me");
    revalidatePath("/");
    return r;
  } catch (e) {
    console.error("[mypage]", e instanceof Error ? e.message : e);
    return { ok: false, text: "保存できませんでした。電波のよい所で、もう一度押してください。" };
  }
}

export async function waveAction(viewerId: string, toId: string): Promise<{ ok: boolean; text: string; mutual?: boolean }> {
  const id = await trustedViewer(viewerId);
  if (!id) return noOwner;
  try {
    const r = await waveTo(id, toId, appNow());
    revalidatePath("/me");
    return r;
  } catch (e) {
    console.error("[mypage]", e instanceof Error ? e.message : e);
    return { ok: false, text: "うまくいきませんでした。もう一度押してください。" };
  }
}
