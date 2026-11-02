// Webhook の署名検証。LINE は本文（生のバイト列）を channel secret で HMAC-SHA256 し、Base64 にして
// x-line-signature ヘッダーに入れて送ってくる。違えば偽の送信なので捨てる。
import { createHmac, timingSafeEqual } from "node:crypto";

export function signBody(body: string, channelSecret: string): string {
  return createHmac("sha256", channelSecret).update(body, "utf8").digest("base64");
}

export function verifySignature(body: string, signature: string | null | undefined, channelSecret: string): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signBody(body, channelSecret));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}
