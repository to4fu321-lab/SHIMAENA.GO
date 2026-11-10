// どこで動いているか（環境変数だけで決める）。
// Vercel では VERCEL=1 が入る。公開されている環境では「開発用の逃げ道」（メモリ保存・仮の鍵・鍵なしの管理画面）を使わない。

/** 公開されている環境（Vercel の本番・プレビュー）か */
export function isDeployed(): boolean {
  return process.env.VERCEL === "1" || (process.env.NODE_ENV === "production" && Boolean(process.env.VERCEL_ENV));
}

/**
 * デモの操作（`?as=h3` で架空の人として押す・見本の状態に戻す）を許すか。
 * 既定は許す（審査・撮影用）。本当にエリアで使うときは Vercel に DEMO_MODE=off を入れる。
 */
export function demoEnabled(): boolean {
  return (process.env.DEMO_MODE ?? "on").trim().toLowerCase() !== "off";
}

/**
 * デモはいつでも「雪の朝」（11/10 本人「デモの場合は雪が積もった朝で依頼もある状態からスタートさせて」）。
 * 審査や見学は夜にも来るので、デモの操作が許されている間は夜の防犯ルール（19時〜6時）で止めず、空も朝にする。
 * 本当にエリアで使うとき（DEMO_MODE=off）は、時計どおり。テストでは時計どおり（夜のルールを確かめるため）。DEMO_MORNING=off でも外せる。
 */
export function demoMorning(): boolean {
  if (process.env.NODE_ENV === "test" || process.env.VITEST) return false;
  return demoEnabled() && (process.env.DEMO_MORNING ?? "on").trim().toLowerCase() !== "off";
}
