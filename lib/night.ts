// 夜の防犯ルール（spec v1.8、本人の指示「雪かきはどの時間でもよい。防犯上、夜は自分の家以外は NG」）。
// 夜（日本時間 19:00〜翌 6:00）は、自分の家の雪かきと、家の中でできること（アプリ・応援・コツ）だけ。
// よその家の手伝い・見回り・雪の報告に出かけるのは、明るい時間に。決めるのは時計だけ（AI は使わない）。
import { jstHourMinute } from "./jst";

/** 夜の始まりと終わり（時。日本時間）。町内会と決めて変えてよい */
export const NIGHT_FROM = 19; // 本人の答え「19時以降は NG」（11/4）
export const NIGHT_UNTIL = 6;

export function isNight(now: Date = new Date()): boolean {
  const h = Number(jstHourMinute(now).slice(11, 13)); // "YYYY-MM-DDTHH:mm" の時
  return h >= NIGHT_FROM || h < NIGHT_UNTIL;
}

/** 夜でもしてよいソロの活動（自分の家と、家の中でできること）。道の危険は、通りがかりに見つけたら夜でも報告してよい（11/4 本人の答え） */
export function allowedAtNight(kind: string, onsite: boolean): boolean {
  return kind === "own_house" || kind === "report_snow" || !onsite;
}

export const NIGHT_TEXT = {
  short: `夜（${NIGHT_FROM}時〜${NIGHT_UNTIL}時）は、自分の家の雪かきだけにしています。`,
  why: "防犯のため、よその家や道の見回りは明るい時間にお願いします。",
} as const;

/** よその家の手伝い（家の雪かきに加わる・人手不足の家へ）を断るときの文 */
export function nightRefusal(): string {
  return `${NIGHT_TEXT.short}${NIGHT_TEXT.why}`;
}
