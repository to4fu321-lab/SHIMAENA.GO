// 「LINE で参加する」の行き先（spec v1.14 LINE で1タップ開始）。
// LIFF があれば LINE アプリの中の /start（最初の「許可する」で本人確認と友だち追加が同時に済み、その画面で30秒の登録）。
// LIFF がない間は、LINE Official Account Manager の友だち追加 URL（環境変数 NEXT_PUBLIC_LINE_ADD_FRIEND_URL）。どちらもなければ「検索して追加」の案内。
export function lineJoinUrl(): string | undefined {
  const liff = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
  if (liff) return `https://liff.line.me/${liff}/start`;
  const u = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL?.trim();
  return u && /^https:\/\//.test(u) ? u : undefined;
}
