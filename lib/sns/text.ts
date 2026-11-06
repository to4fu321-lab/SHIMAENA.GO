// SNS に投稿する文の定型（spec v1.3）。数字は集計（PublicStats）からだけ入れる。Claude が使えないときの文でもある。
// X は日本語1字を2と数え、URL は 23 で数えるので、本文は 115 字以内にする。
import type { PublicStats } from "../public/stats";

export type ShareKind = "today" | "town" | "recruit" | "me";

export const SHARE_TEXT_MAX = 115;
export const HASHTAGS = ["#シマエナGO", "#10分だけ出動"] as const;

/** 個人の活動カード用（本人の数字だけ。呼び名は本人が自分で共有するときだけ） */
export interface MeStats {
  todayFeathers: number;
  streak: number;
  todayActs: number;
  /** 今日のシマエナ（最新のカードのタッチ名） */
  shimaena?: string;
  hitokoto?: string;
}

export function clampShareText(s: string): string {
  const t = s.trim();
  return [...t].length <= SHARE_TEXT_MAX ? t : `${[...t].slice(0, SHARE_TEXT_MAX - 1).join("")}…`;
}

export function mockShareText(kind: ShareKind, st: PublicStats, me?: MeStats): string {
  switch (kind) {
    case "today": {
      const goal = st.housesTotal === 0 ? "" : st.left > 0 ? `\nあと${st.left}軒で今日のエリア達成！` : "\n今日のエリア、達成！";
      return clampShareText(
        `今日もシマエナGO出動！\n${st.todayPeople}羽のシマエナが町の雪を少し溶かしました。${goal}\n${HASHTAGS.join(" ")}`,
      );
    }
    case "town":
      return clampShareText(
        `${st.townName}の雪解け ${st.thawPct}%。\n今週は${st.week.people}人で${st.week.housesDone}軒を助けました。\nあなたの町にもシマエナを。\n#シマエナGO #雪解け`,
      );
    case "recruit":
      return clampShareText(
        st.shortHouses > 0 && st.shortMissingMin === 1
          ? `あと1人で雪解け！\n10分だけ参加しませんか？\nあなたの10分で町が変わる。\n${HASHTAGS.join(" ")}`
          : st.shortHouses > 0
            ? `人手が足りない家が${st.shortHouses}軒。\n10分だけ参加しませんか？\n${HASHTAGS.join(" ")}`
            : `今日の町を一緒に救おう。\n10分だけ、誰かのために。\n#シマエナGO #雪解け`,
      );
    case "me": {
      const m = me ?? { todayFeathers: 0, streak: 0, todayActs: 0 };
      return clampShareText(
        `今日は10分だけ出動。\n羽 ${m.todayFeathers}、連続${m.streak}日。\n小さな一歩で町が変わる。\n${HASHTAGS.join(" ")}`,
      );
    }
  }
}
