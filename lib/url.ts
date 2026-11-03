// 公開 URL（LINE に画像の URL を渡す・SNS のリンク・OG 画像の絶対 URL）。サーバーと画面の両方から使える。
export function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

/** LIFF の ID があれば LINE の中で開く URL、なければふつうの URL */
export function liffUrl(path: string): string {
  const id = process.env.NEXT_PUBLIC_LIFF_ID;
  return id ? `https://liff.line.me/${id}${path}` : `${baseUrl()}${path}`;
}
