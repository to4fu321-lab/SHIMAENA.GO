// 「参加する」の行き先（spec v1.17）: アプリの /start（LINE でログイン → 画面で30秒の登録）。
// 名前は LINE のころのまま（呼ぶ側を変えずに済むように）。href にそのまま使える道（/start）を返す
export function lineJoinUrl(): string {
  return "/start";
}
