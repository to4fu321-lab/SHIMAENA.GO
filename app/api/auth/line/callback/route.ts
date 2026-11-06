// LINE の許可画面から戻ってくる所（spec v1.17）。state を確かめ、code を本人に替える。
// 登録済み → この画面の「自分」（cookie）にして戻り先へ。未登録 → 登録前の印（cookie）を付けて /start へ。
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { exchangeCode, safeNext } from "@/lib/auth/line-login";
import { PENDING_COOKIE, PENDING_MAX_AGE, signPending } from "@/lib/auth/pending";
import { INVITE_COOKIE, isInviteCode, linkInvitee } from "@/lib/invite";
import { ensureTeam } from "@/lib/member";
import { repo } from "@/lib/repo";
import { baseUrl } from "@/lib/url";
import { signViewer, VIEWER_COOKIE } from "@/lib/viewer";

const STATE_COOKIE = "shimaena_ll";
const opts = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const jar = await cookies();
  const fail = (why: string) => NextResponse.redirect(`${baseUrl()}/login?error=${why}`);
  let saved: { state: string; nonce: string; next: string } | undefined;
  try {
    saved = JSON.parse(jar.get(STATE_COOKIE)?.value ?? "");
  } catch {}
  jar.delete(STATE_COOKIE);
  if (url.searchParams.get("error")) return fail("denied");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!saved || !code || !state || state !== saved.state) return fail("state");
  const me = await exchangeCode(code, saved.nonce);
  if (!me) return fail("verify");

  const next = safeNext(saved.next);
  const found = await repo().findParticipantByLineUserId(me.userId);
  if (!found) {
    // まだ登録がない: 登録前の印を付けて、30秒の登録へ
    jar.set(PENDING_COOKIE, signPending({ lineUserId: me.userId, displayName: me.displayName }), { ...opts, maxAge: PENDING_MAX_AGE });
    return NextResponse.redirect(`${baseUrl()}/start?next=${encodeURIComponent(next)}`);
  }
  const p = await ensureTeam(found).catch(() => found); // 前に登録したお願いする側の人も、アプリを開いたらチームに入る（spec v1.10）
  const inv = jar.get(INVITE_COOKIE)?.value;
  if (isInviteCode(inv)) await linkInvitee(p.id, inv).catch(() => undefined); // 招待リンクから来た人を、誘った人と結ぶ（最初の1回だけ）
  jar.delete(PENDING_COOKIE);
  jar.set(VIEWER_COOKIE, signViewer(p.id), { ...opts, maxAge: 60 * 60 * 24 * 180 });
  return NextResponse.redirect(`${baseUrl()}${next}`);
}
