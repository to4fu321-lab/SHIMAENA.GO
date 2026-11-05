"use server";

// なかま機能（spec v1.13）の画面の操作。本人確認は今までどおり（LINE でログインした本人か、デモの架空の人だけ）。
import { revalidatePath } from "next/cache";
import { answerMeetup, leaveBaton, proposeMeetup, reactToBaton, setNextWish, setTodayMode } from "@/lib/nakama/ops";
import { trustedViewer } from "@/lib/viewer";

export interface NakamaResult {
  ok: boolean;
  text: string;
  story?: string;
  matched?: { otherName: string; baseNumber?: number; missionId?: string };
}

const who = async (viewerId: string) => trustedViewer(viewerId);
const noOwner: NakamaResult = { ok: false, text: "この画面の持ち主を確かめられませんでした。LINE から開いてください。" };

async function safe(f: () => Promise<NakamaResult>): Promise<NakamaResult> {
  try {
    return await f();
  } catch (e) {
    console.error("[nakama]", e instanceof Error ? e.message : e);
    return { ok: false, text: "うまくいきませんでした。電波のよい所で、もう一度押してください。" };
  }
}

export async function todayModeAction(viewerId: string, mode: string): Promise<NakamaResult> {
  return safe(async () => {
    const id = await who(viewerId);
    if (!id) return noOwner;
    const r = await setTodayMode(id, mode, new Date());
    revalidatePath("/nakama");
    return r;
  });
}

export async function nextWishAction(viewerId: string, wish: string): Promise<NakamaResult> {
  return safe(async () => {
    const id = await who(viewerId);
    if (!id) return noOwner;
    return setNextWish(id, wish);
  });
}

export async function proposeAction(viewerId: string, toId: string, window: string): Promise<NakamaResult> {
  return safe(async () => {
    const id = await who(viewerId);
    if (!id) return noOwner;
    const r = await proposeMeetup(id, toId, window, new Date());
    revalidatePath("/nakama");
    return r;
  });
}

export async function answerAction(viewerId: string, meetupId: string, accept: boolean): Promise<NakamaResult> {
  return safe(async () => {
    const id = await who(viewerId);
    if (!id) return noOwner;
    const r = await answerMeetup(id, meetupId, accept, new Date());
    revalidatePath("/nakama");
    return r;
  });
}

export async function batonAction(
  viewerId: string,
  input: { source: string; status: string; preset?: string; text?: string; photoChecked?: boolean; missionId?: string },
): Promise<NakamaResult> {
  return safe(async () => {
    const id = await who(viewerId);
    if (!id) return noOwner;
    const r = await leaveBaton(id, input, new Date());
    revalidatePath("/nakama");
    return r;
  });
}

export async function reactAction(viewerId: string, batonId: string, reaction: string): Promise<NakamaResult> {
  return safe(async () => {
    const id = await who(viewerId);
    if (!id) return noOwner;
    const r = await reactToBaton(id, batonId, reaction);
    revalidatePath("/nakama");
    return r;
  });
}
