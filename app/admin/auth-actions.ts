"use server";
// /admin のログイン・ログアウト。合言葉が違うときは少し待たせる（総当たりを遅くする）。
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, ADMIN_MAX_AGE, adminToken, passwordMatches } from "@/lib/admin-auth";

export async function loginAction(formData: FormData): Promise<void> {
  const input = String(formData.get("password") ?? "");
  if (!passwordMatches(input)) {
    await new Promise((r) => setTimeout(r, 1000));
    redirect("/admin?login=failed");
  }
  (await cookies()).set(ADMIN_COOKIE, adminToken(input.trim()), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_MAX_AGE,
  });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin");
}
