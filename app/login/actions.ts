"use server";

// ログアウト（この端末の「自分」の印を消す）。spec v1.17。戻り先は入口の /start（spec v1.63）
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PENDING_COOKIE } from "@/lib/auth/pending";
import { VIEWER_COOKIE } from "@/lib/viewer";

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  jar.delete(VIEWER_COOKIE);
  jar.delete(PENDING_COOKIE);
  redirect("/start");
}
