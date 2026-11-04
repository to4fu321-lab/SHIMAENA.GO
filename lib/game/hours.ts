// 雪かきの時間（spec v1.8）: 6:00〜19:00 なら、いつ始めても・いつ終わってもよい。19時以降は暗くて危ないので受け付けない。
// 朝（9:00 まで）とドカ雪の日（予報 15cm 以上）は、完了した人にボーナス。
import { jstMinutes } from "../jst";
import { NIGHT_FROM, NIGHT_UNTIL, isNight } from "../night";

// 夜の時間は lib/night.ts（防犯ルール）と同じものを使う
export const WORK_START_MIN = NIGHT_UNTIL * 60;
export const WORK_END_MIN = NIGHT_FROM * 60;
/** 朝ボーナスの締め切り（9:00 まで。7時からの人も9時からの人も入る） */
export const MORNING_BONUS_UNTIL_MIN = 9 * 60;
/** ドカ雪の日（予報の積雪 cm がこれ以上）。雪の名前「どか雪」と同じ線 */
export const DOKAYUKI_CM = 15;

/** よその家の雪かきをしてよい時間か（日本時間 6:00〜19:00）。夜でも自分の家の雪かきは OK（lib/night.ts） */
export function isWorkHours(now: Date = new Date()): boolean {
  return !isNight(now);
}

/** 朝ボーナスの時間に終わったか（日本時間 9:00 まで） */
export function isMorningDone(completedAtIso: string): boolean {
  return jstMinutes(new Date(completedAtIso)) <= MORNING_BONUS_UNTIL_MIN;
}

export function isDokayuki(forecastCm: number | undefined): boolean {
  return (forecastCm ?? 0) >= DOKAYUKI_CM;
}
