// アプリの「いま」（11/10 本人「デモの時は時間を雪かきができる時間に変更して」）。
// デモの間（lib/env.ts の demoMorning）に本当の時計が夜（日本時間 19時〜翌6時）なら、時計を12時間もどして
// 雪かきができる時間（7時〜18時）にする。例: 22:30 → 10:30、1:15 → 前の日の 13:15。
// 記録の時刻・カードの時刻・空・「今日」がこの時計でそろう。昼は本当の時計のまま。
// 本当の夜に人のスマホへ通知を送るか、定期実行（cron）、ログインの期限は、本当の時計（new Date()）で決める。
import { demoMorning } from "./env";

export const DEMO_SHIFT_MS = 12 * 60 * 60 * 1000;

function jstHour(d: Date): number {
  return new Date(d.getTime() + 9 * 3600 * 1000).getUTCHours();
}

/** いま、デモの時計を12時間もどしているか（本当の夜のデモ） */
export function demoShiftActive(real: Date = new Date()): boolean {
  if (!demoMorning()) return false;
  const h = jstHour(real);
  return h >= 19 || h < 6;
}

/** アプリの時計と本当の時計の差（ミリ秒。もどしていなければ 0） */
export function appOffsetMs(real: Date = new Date()): number {
  return demoShiftActive(real) ? -DEMO_SHIFT_MS : 0;
}

/** アプリの「いま」 */
export function appNow(): Date {
  const real = new Date();
  return new Date(real.getTime() + appOffsetMs(real));
}
