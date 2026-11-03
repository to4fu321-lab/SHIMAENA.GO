// 町を応援する（spec v1.3）: SNS の閲覧者が押せる。日付ごとの件数だけ。得点にも羽にも入れない（雪かきの完了にもしない）。
export const CHEER_COOKIE = "cheered";
/** ゲージが満タンになる目安（超えてもよい） */
export const CHEER_GOAL = 30;
/** 1日の上限（いたずらで数が壊れないように） */
export const CHEER_DAILY_MAX = 500;

/** 今日もう押したか（cookie に押した日付を入れておく） */
export function cheeredToday(cookieValue: string | undefined, today: string): boolean {
  return cookieValue === today;
}

export function cheerPct(count: number): number {
  return Math.min(100, Math.round((count / CHEER_GOAL) * 100));
}
