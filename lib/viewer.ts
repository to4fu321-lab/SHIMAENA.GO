// 画面を見ている人の印（cookie）。LINE でログインした人を参加者 ID に結びつけ、署名して持つ（spec v1.17）。
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { appSecret } from "./auth/secret";
import { demoEnabled } from "./env";

export const VIEWER_COOKIE = "viewer";

/** 署名の鍵（lib/auth/secret.ts）。公開環境で鍵がなければ使わない（誰でも知っている仮の鍵で本人になりすませてしまうため） */
const secret = appSecret;

function sign(id: string): string | undefined {
  const key = secret();
  return key ? createHmac("sha256", key).update(id).digest("base64url") : undefined;
}

export function signViewer(participantId: string): string {
  const sig = sign(participantId);
  if (!sig) throw new Error("署名の鍵（AUTH_SECRET）がないので、ログインの印を作れません");
  return `${participantId}.${sig}`;
}

/** 署名が合っていれば参加者 ID を返す */
export function readViewer(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const i = value.lastIndexOf(".");
  if (i <= 0) return undefined;
  const id = value.slice(0, i);
  const key = sign(id);
  if (!key) return undefined;
  const sig = Buffer.from(value.slice(i + 1));
  const expected = Buffer.from(key);
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return undefined;
  return id;
}

/** デモの `?as=h3`（架空の手伝う側）と `?as=r2`（架空のお願いする側、ソロ出動の「自分の家」用）。本物の人は cookie で */
export function isDemoViewer(id: string): boolean {
  return /^[hr]\d+$/.test(id);
}

/**
 * 画面が言う「自分」を信じてよいか: デモの架空の人か、cookie で確かめた本人だけ（server action から呼ぶ）。
 * 本当にエリアで使うとき（DEMO_MODE=off）は、架空の人として押すことはできない（見るだけ）。
 */
export async function trustedViewer(viewerId: string): Promise<string | null> {
  if (isDemoViewer(viewerId)) return demoEnabled() ? viewerId : null;
  const fromCookie = readViewer((await cookies()).get(VIEWER_COOKIE)?.value);
  return fromCookie === viewerId ? viewerId : null;
}
