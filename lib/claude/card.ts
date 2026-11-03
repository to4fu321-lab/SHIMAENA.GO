// カードの文字: デザイン名・英語副題・排雪量と身近な換算（spec 7, 9-4）。絵は lib/cards/svg.ts が描く。
import { z } from "zod";
import { STYLE_NAME } from "../cards/rarity";
import type { CardStyle, ClearArea } from "../types";
import { askJson, hasClaudeKey } from "./client";

export const CardTextSchema = z.object({
  designName: z.string(), // 例: 玄関までの三十歩
  designNameEn: z.string(), // 例: Thirty Steps to the Door
  snowKg: z.number().int(),
  snowKgComparison: z.string(), // 例: 軽トラ1台分
  /** 絵の中の英語のひとこと（5語まで） */
  flavor: z.string(),
});
export type CardText = z.infer<typeof CardTextSchema>;

export interface CardTextInput {
  date: string;
  completedAtJst: string; // HH:mm
  forecastCm: number;
  level: 1 | 2 | 3;
  clearArea: ClearArea;
  memberCount: number;
  teamNames: string[];
  style: CardStyle;
  rarityLabel: string;
}

/** 面積（m²）の目安: 玄関前 12 / 車庫前 30 / 道路まで 50 */
const AREA_M2: Record<ClearArea, number> = { entrance: 12, garage: 30, road: 50 };
/** 新雪の密度（kg/m³）の目安 */
const SNOW_DENSITY = 150;

export function estimateSnowKg(forecastCm: number, clearArea: ClearArea): number {
  return Math.max(20, Math.round((AREA_M2[clearArea] * (forecastCm / 100) * SNOW_DENSITY) / 10) * 10);
}

export function snowComparison(kg: number): string {
  if (kg < 100) return "米袋3つ分";
  if (kg < 300) return "大人4人分";
  if (kg < 700) return "軽トラ半分";
  if (kg < 1200) return "軽トラ1台分";
  if (kg < 2000) return "軽トラ2台分";
  return "小型トラック1台分";
}

const NAMES: Record<CardStyle, [string, string, string][]> = {
  kawaii: [
    ["玄関までの三十歩", "Thirty Steps to the Door", "Have a nice snow day!"],
    ["朝いちばんの白い道", "First White Road", "Good morning, snow!"],
    ["スコップと湯気", "Shovel and Steam", "Warm hands, warm hearts"],
  ],
  retrowave: [
    ["朝六時のネオン", "Neon at Six", "Rise and shine"],
    ["夜明け前の群れ", "Flock Before Dawn", "Before the sun"],
  ],
  kirie: [
    ["大雪の朝の切り紙", "Paper Morning, Heavy Snow", "Deep snow, deep thanks"],
    ["白い屋根の町", "Town of White Roofs", "Snow upon snow"],
  ],
  pixel: [
    ["五日目のドット", "Day Five, Pixel Perfect", "5 DAYS STREAK"],
    ["つづく朝のレベルアップ", "Level Up Mornings", "CONTINUE?"],
  ],
  eijin: [
    ["二色の群れ、ひとつの道", "Two Colors, One Path", "Together we dig"],
    ["湾岸ぽい朝の除雪", "Bayside Snow Morning", "Mixed crew, nice view"],
  ],
};

export function mockCardText(input: CardTextInput): CardText {
  const list = NAMES[input.style];
  const seed = Number(input.date.replace(/-/g, "")) + input.memberCount + input.level;
  const [designName, designNameEn, flavor] = list[seed % list.length];
  const snowKg = estimateSnowKg(input.forecastCm, input.clearArea);
  return { designName, designNameEn, snowKg, snowKgComparison: snowComparison(snowKg), flavor };
}

export async function cardText(input: CardTextInput): Promise<CardText> {
  if (!hasClaudeKey()) return mockCardText(input);
  const res = await askJson({
    task:
      "ありがとうカードの文字を作ってください。designName は日本語 6〜12 文字で、その朝の状況（時刻・人数・雪の量・チームの混成）が伝わる詩的だが分かりやすい名前。" +
      "designNameEn は英語の副題。snowKg は面積の目安（玄関前 12m²／車庫前 30m²／道路まで 50m²）× 降雪 cm × 新雪 150kg/m³ から整数で。" +
      "snowKgComparison は身近な換算（軽トラ1台分 など）。flavor は絵の中に入れる英語のひとこと（5語まで）。タッチの名前: " +
      STYLE_NAME[input.style],
    input,
    schema: CardTextSchema,
    effort: "low",
  });
  return { ...res, snowKg: Math.max(10, Math.round(res.snowKg)) };
}
