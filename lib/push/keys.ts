// 端末への通知（Web Push）の鍵（spec v1.17）。`npx web-push generate-vapid-keys` で作り、Vercel の環境変数に入れる。
// VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY（サーバーだけ）、NEXT_PUBLIC_VAPID_PUBLIC_KEY（画面にも出してよい公開鍵。VAPID_PUBLIC_KEY と同じ値）
export function hasPushKeys(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function publicVapidKey(): string | undefined {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || undefined;
}
