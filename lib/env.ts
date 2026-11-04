// どこで動いているか（環境変数だけで決める）。
// Vercel では VERCEL=1 が入る。公開されている環境では「開発用の逃げ道」（メモリ保存・仮の鍵・鍵なしの管理画面）を使わない。

/** 公開されている環境（Vercel の本番・プレビュー）か */
export function isDeployed(): boolean {
  return process.env.VERCEL === "1" || (process.env.NODE_ENV === "production" && Boolean(process.env.VERCEL_ENV));
}

/**
 * デモの操作（`?as=h3` で架空の人として押す・見本の状態に戻す）を許すか。
 * 既定は許す（審査・撮影用）。本当に町内で使うときは Vercel に DEMO_MODE=off を入れる。
 */
export function demoEnabled(): boolean {
  return (process.env.DEMO_MODE ?? "on").trim().toLowerCase() !== "off";
}

/** LINE に本当には送らず、記録だけする（検証で月の通数を使わないため）。LINE_DRY_RUN=1 */
export function lineDryRun(): boolean {
  return ["1", "true", "on"].includes((process.env.LINE_DRY_RUN ?? "").trim().toLowerCase());
}
