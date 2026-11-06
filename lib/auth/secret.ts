// アプリの署名の鍵（ログインの印・合言葉・招待の印に使う）。spec v1.17: `AUTH_SECRET`。
// なければ今までの `LINE_CHANNEL_SECRET`、それもなければ LINE ログインの秘密（どれも公開しない）。
// 公開環境でどれもなければ使わない（誰でも知っている仮の鍵で本人になりすませてしまうため）。手元の開発だけ仮の鍵。
import { isDeployed } from "../env";

export function appSecret(): string | undefined {
  const s = process.env.AUTH_SECRET || process.env.LINE_CHANNEL_SECRET || process.env.LINE_LOGIN_CHANNEL_SECRET;
  if (s) return s;
  return isDeployed() ? undefined : "dev-only-secret";
}
