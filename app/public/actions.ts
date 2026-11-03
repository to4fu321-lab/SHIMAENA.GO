"use server";

// 公開ページの操作。ここに書いた関数は誰でも呼べる（公開 API になる）ので、「町を応援する」だけを置く。
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { loadMorning } from "@/lib/morning/store";
import { appToday } from "@/lib/morning/today";
import { CHEER_COOKIE, CHEER_DAILY_MAX, cheeredToday } from "@/lib/public/cheer";
import { repo } from "@/lib/repo";

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
  jar.set(CHEER_COOKIE, today, { sameSite: "lax", path: "/", maxAge: 60 * 60 * 36, httpOnly: true, secure: process.env.NODE_ENV === "production" });
  revalidatePath("/public/town");
  revalidatePath("/");
  return { ok: true, count, already: false };
}
