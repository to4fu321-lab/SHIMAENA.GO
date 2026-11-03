// LINE 友だち追加（参加）の URL。本人が LINE Official Account Manager の「友だちを増やす」で取った URL を
// Vercel の環境変数 NEXT_PUBLIC_LINE_ADD_FRIEND_URL に入れる。ない間は「検索して追加」の案内を出す。
export function lineJoinUrl(): string | undefined {
  const u = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL?.trim();
  return u && /^https:\/\//.test(u) ? u : undefined;
}
