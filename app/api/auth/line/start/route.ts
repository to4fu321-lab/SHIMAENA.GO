// 「LINE でログイン」の入口（spec v1.17）。state と nonce を cookie に置いて、LINE の許可画面へ。
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authorizeUrl, hasLoginKeys, randomToken, safeNext } from "@/lib/auth/line-login";
import { baseUrl } from "@/lib/url";

export const STATE_COOKIE = "shimaena_ll";

export async function GET(req: Request): Promise<Response> {
  const next = safeNext(new URL(req.url).searchParams.get("next"));
  if (!hasLoginKeys()) return NextResponse.redirect(`${baseUrl()}/login?error=nokeys&next=${encodeURIComponent(next)}`);
  const state = randomToken();
  const nonce = randomToken();
  (await cookies()).set(STATE_COOKIE, JSON.stringify({ state, nonce, next }), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 600 });
  return NextResponse.redirect(authorizeUrl(state, nonce));
}
