// LINE でログインしたが、まだ登録していない人の印（cookie）。spec v1.17。
// 中身は LINE のアカウント ID と表示名と期限。署名つき（画面側の申告を信じない）。/start の登録で使い、登録が終わったら消す。
import { createHmac, timingSafeEqual } from "node:crypto";
import { appSecret } from "./secret";

export const PENDING_COOKIE = "shimaena_pending";
export const PENDING_MAX_AGE = 60 * 60 * 24 * 7; // 7日（あとで戻ってきても登録できる）

export interface PendingLogin {
  lineUserId: string;
  displayName: string;
  /** 期限（ミリ秒） */
  exp: number;
}

function sign(payload: string): string | undefined {
  const key = appSecret();
  return key ? createHmac("sha256", key).update(payload).digest("base64url") : undefined;
}

export function signPending(p: Omit<PendingLogin, "exp">, now = new Date()): string {
  const payload = Buffer.from(JSON.stringify({ ...p, exp: now.getTime() + PENDING_MAX_AGE * 1000 } satisfies PendingLogin)).toString("base64url");
  const sig = sign(payload);
  if (!sig) throw new Error("署名の鍵（AUTH_SECRET）がないので、ログインの印を作れません");
  return `${payload}.${sig}`;
}

export function readPending(value: string | undefined, now = new Date()): PendingLogin | undefined {
  if (!value) return undefined;
  const i = value.lastIndexOf(".");
  if (i <= 0) return undefined;
  const payload = value.slice(0, i);
  const expected = sign(payload);
  if (!expected) return undefined;
  const a = Buffer.from(value.slice(i + 1));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
  try {
    const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as PendingLogin;
    if (!p.lineUserId || typeof p.exp !== "number" || p.exp < now.getTime()) return undefined;
    return { lineUserId: p.lineUserId, displayName: String(p.displayName ?? ""), exp: p.exp };
  } catch {
    return undefined;
  }
}
