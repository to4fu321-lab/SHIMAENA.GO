// 地図を見ている人の印（cookie）。LIFF でログインした LINE のユーザーを参加者 ID に結びつけ、署名して持つ。
import { createHmac, timingSafeEqual } from "node:crypto";

export const VIEWER_COOKIE = "viewer";

function secret(): string {
  return process.env.LINE_CHANNEL_SECRET ?? "dev-only-secret";
}

function sign(id: string): string {
  return createHmac("sha256", secret()).update(id).digest("base64url");
}

export function signViewer(participantId: string): string {
  return `${participantId}.${sign(participantId)}`;
}

/** 署名が合っていれば参加者 ID を返す */
export function readViewer(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const i = value.lastIndexOf(".");
  if (i <= 0) return undefined;
  const id = value.slice(0, i);
  const sig = Buffer.from(value.slice(i + 1));
  const expected = Buffer.from(sign(id));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return undefined;
  return id;
}

/** デモの `?as=h3` は架空の手伝う側だけ。本物の人は cookie で */
export function isDemoViewer(id: string): boolean {
  return /^h\d+$/.test(id);
}
