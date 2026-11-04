// 管理画面 /admin の鍵。Vercel の環境変数 ADMIN_PASSWORD と同じ合言葉を入れた人だけが操作できる。
// 合言葉そのものは cookie に入れず、合言葉から作った印（HMAC）を入れる。合言葉を変えると全員ログアウトになる。
// 手元の開発（公開していない環境）で ADMIN_PASSWORD がなければ、鍵なしで開ける。
// 公開している環境で ADMIN_PASSWORD がなければ、誰も操作できない（開けっぱなしにしない）。
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { isDeployed } from "./env";

export const ADMIN_COOKIE = "shimaena_admin";
export const ADMIN_MAX_AGE = 60 * 60 * 12; // 12時間

export type AdminGate = "open" | "ok" | "login" | "unconfigured";

function password(): string | undefined {
  const p = process.env.ADMIN_PASSWORD?.trim();
  return p ? p : undefined;
}

/** 合言葉から作る印（cookie に入れる値） */
export function adminToken(pass: string): string {
  return createHmac("sha256", pass).update("shimaena-admin-v1").digest("base64url");
}

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** 合言葉が合っているか（時間で中身が分からないように比べる） */
export function passwordMatches(input: string): boolean {
  const pass = password();
  if (!pass) return false;
  return same(adminToken(input.trim()), adminToken(pass));
}

/** いまの人が管理の操作をしてよいか */
export async function adminGate(): Promise<AdminGate> {
  const pass = password();
  if (!pass) return isDeployed() ? "unconfigured" : "open";
  const value = (await cookies()).get(ADMIN_COOKIE)?.value;
  return value && same(value, adminToken(pass)) ? "ok" : "login";
}

export class AdminRequiredError extends Error {
  constructor() {
    super("管理の操作には合言葉でのログインが必要です");
  }
}

/** Server Action の最初に呼ぶ。だめなら例外 */
export async function requireAdmin(): Promise<void> {
  const gate = await adminGate();
  if (gate !== "open" && gate !== "ok") throw new AdminRequiredError();
}
