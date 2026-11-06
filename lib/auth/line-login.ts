// LINE ログイン（Web 版、OAuth 2.0 / OpenID Connect）。spec v1.17: LINE はログインだけに使う。
// 鍵: LINE_LOGIN_CHANNEL_ID / LINE_LOGIN_CHANNEL_SECRET（LINE Developers の「LINE ログイン」チャネル。設定は docs/login-setup.md）。
// 流れ: /api/auth/line/start → LINE の許可画面 → /api/auth/line/callback（code）→ ここで token に替え、id_token を LINE に確かめてもらう → アカウント ID と表示名。
import { randomBytes } from "node:crypto";
import { baseUrl } from "../url";

const AUTHORIZE = "https://access.line.me/oauth2/v2.1/authorize";
const TOKEN = "https://api.line.me/oauth2/v2.1/token";
const VERIFY = "https://api.line.me/oauth2/v2.1/verify";

export function hasLoginKeys(): boolean {
  return Boolean(process.env.LINE_LOGIN_CHANNEL_ID && process.env.LINE_LOGIN_CHANNEL_SECRET);
}

export function redirectUri(): string {
  return `${baseUrl()}/api/auth/line/callback`;
}

export const randomToken = () => randomBytes(18).toString("base64url");

/** LINE の許可画面の URL */
export function authorizeUrl(state: string, nonce: string): string {
  const u = new URL(AUTHORIZE);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", process.env.LINE_LOGIN_CHANNEL_ID ?? "");
  u.searchParams.set("redirect_uri", redirectUri());
  u.searchParams.set("state", state);
  u.searchParams.set("scope", "profile openid");
  u.searchParams.set("nonce", nonce);
  return u.toString();
}

export interface LineIdentity {
  userId: string;
  displayName: string;
}

/** 許可画面から戻ってきた code を、本人のアカウント ID と表示名に替える。確かめられなければ undefined */
export async function exchangeCode(code: string, nonce: string): Promise<LineIdentity | undefined> {
  const id = process.env.LINE_LOGIN_CHANNEL_ID;
  const secret = process.env.LINE_LOGIN_CHANNEL_SECRET;
  if (!id || !secret) return undefined;
  try {
    const tok = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), client_id: id, client_secret: secret }),
    });
    if (!tok.ok) {
      console.error("[line-login] token:", tok.status, (await tok.text()).slice(0, 200));
      return undefined;
    }
    const { id_token } = (await tok.json()) as { id_token?: string };
    if (!id_token) return undefined;
    // id_token は自分で読まず、LINE に確かめてもらう（なりすまし・別チャネルのトークンを防ぐ）
    const ver = await fetch(VERIFY, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ id_token, client_id: id, nonce }),
    });
    if (!ver.ok) {
      console.error("[line-login] verify:", ver.status, (await ver.text()).slice(0, 200));
      return undefined;
    }
    const claims = (await ver.json()) as { sub?: string; name?: string };
    return claims.sub ? { userId: claims.sub, displayName: claims.name ?? "" } : undefined;
  } catch (e) {
    console.error("[line-login]", e instanceof Error ? e.message : e);
    return undefined;
  }
}

/** 戻り先（アプリの中の道だけ。外のサイトには飛ばさない） */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next.slice(0, 200);
}
