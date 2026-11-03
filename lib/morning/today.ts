// アプリの「今日」。本番の cron は本当の日付で動くが、デモは 12 月の朝（DEMO_DATE）の世界で一貫させたい。
// 今朝の点呼の日付が本当の日付の前後1日以内なら本当の日付、それ以外（デモ）は点呼の日付を「今日」にする。
// ソロ台帳の日付・連続出動日数・応援の日付・週の範囲・公開ページの集計は、すべてここを通す。
import { jstDate } from "../jst";
import type { MorningRecord } from "./flow";

/** 2つの日付（YYYY-MM-DD）の差（日） */
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

export function appToday(record: Pick<MorningRecord, "morning">, now: Date = new Date()): string {
  const real = jstDate(now);
  const rc = record.morning.rollcall.date;
  return Math.abs(dayDiff(rc, real)) <= 1 ? real : rc;
}
