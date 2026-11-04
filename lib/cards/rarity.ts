// レア度（spec 7）: レアでタッチが変わる。早朝＝80sレトロウェーブ／大雪＝切り絵／連続5日＝ドット絵／混成＝鈴木英人系。
import { jstMinutes } from "../jst";

/** 「早朝の群れ」のカード: 7:30 までに完了（得点の朝ボーナスは 9:00 まで。カードの絵柄は前のまま） */
const isEarly = (iso: string) => jstMinutes(new Date(iso)) <= 7 * 60 + 30;
import type { CardStyle, TeamId } from "../types";

export const BIG_SNOW_CM = 20;

export interface RarityInput {
  completedAt: string; // ISO
  forecastCm: number;
  teamIds: TeamId[];
  /** 受け取る人の今週の連続出撃日数（今日を含む） */
  streakDays: number;
}

export interface Rarity {
  style: CardStyle;
  label: string;
  stars: 1 | 2 | 3;
}

export const STYLE_NAME: Record<CardStyle, string> = {
  kawaii: "かわいいシティポップ",
  retrowave: "80s レトロウェーブ",
  kirie: "切り絵",
  pixel: "ドット絵",
  eijin: "湾岸ポップ",
};

/** 重なったときは、めずらしい順に 連続5日 → 混成 → 大雪 → 早朝 → 基本 */
export function decideRarity(input: RarityInput): Rarity {
  const teams = new Set(input.teamIds);
  if (input.streakDays >= 5) return { style: "pixel", label: "五日連続の群れ", stars: 3 };
  if (teams.size >= 2) return { style: "eijin", label: "混成の群れ", stars: 3 };
  if (input.forecastCm >= BIG_SNOW_CM) return { style: "kirie", label: "大雪の群れ", stars: 3 };
  if (isEarly(input.completedAt)) return { style: "retrowave", label: "早朝の群れ", stars: 2 };
  return { style: "kawaii", label: "朝の群れ", stars: 1 };
}
