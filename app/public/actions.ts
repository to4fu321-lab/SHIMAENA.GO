"use server";

// 公開ページの操作。ここに書いた関数は誰でも呼べる（公開 API になる）ので、「町を応援する」と「招待リンクを開いた」だけを置く。
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { loadMorning } from "@/lib/morning/store";
import { appToday } from "@/lib/morning/today";
import { CHEER_COOKIE, CHEER_DAILY_MAX, cheeredToday } from "@/lib/public/cheer";
import { repo } from "@/lib/repo";
import { INVITE_COOKIE, isInviteCode, recordInviteCheer, recordInviteOpen } from "@/lib/invite";

export interface CheerResult {
  ok: boolean;
  count: number;
  /** 今日はもう押していた */
  already: boolean;
}

/** 町を応援する（1日1回）。得点・羽には入れない */
export async function cheerTownAction(): Promise<CheerResult> {
  const today = appToday(await loadMorning());
  const jar = await cookies();
  const r = repo();
  const current = await r.getCheer(today).catch(() => 0);
  if (cheeredToday(jar.get(CHEER_COOKIE)?.value, today)) return { ok: false, count: current, already: true };
  if (current >= CHEER_DAILY_MAX) return { ok: false, count: current, already: false };
  const count = await r.incrementCheer(today);
  // 招待リンクから来た人の応援は、誘った人の「町を応援してくれた人」に数える（v1.8）
  const inv = jar.get(INVITE_COOKIE)?.value;
  if (isInviteCode(inv)) await recordInviteCheer(inv);
  jar.set(CHEER_COOKIE, today, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 36, httpOnly: true, secure: process.env.NODE_ENV === "production" });
  revalidatePath("/public/town");
  revalidatePath("/");
  return { ok: true, count, already: false };
}

/** 招待リンクを開いた（同じ人が同じ招待で何度開いても1回。v1.8）。誰が誘ったかは分からないコードだけを扱う */
export async function inviteOpenAction(code: string): Promise<void> {
  if (!isInviteCode(code)) return;
  const jar = await cookies();
  if (jar.get(INVITE_COOKIE)?.value === code) return;
  jar.set(INVITE_COOKIE, code, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30, httpOnly: true, secure: process.env.NODE_ENV === "production" });
  await recordInviteOpen(code);
}
