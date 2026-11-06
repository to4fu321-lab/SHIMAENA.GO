// 公開 URL（LINE に画像の URL を渡す・SNS のリンク・OG 画像の絶対 URL）。サーバーと画面の両方から使える。
export function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** 画面を開く URL（絶対 URL）。名前は LIFF のころのまま（呼ぶ側を変えずに済むように）。spec v1.17 で LIFF はやめた */
export function liffUrl(path: string): string {
  return `${baseUrl()}${path}`;
}
