// カードの文字: デザイン名・英語副題・排雪量と身近な換算（spec 7, 9-4）。絵は lib/cards/svg.ts が描く。
// v1.8: 排雪 kg はプログラムが計算する（lib/snow-estimate.ts。写真の深さ・予報・積雪深を突き合わせる）。Claude は名前と副題とひとことだけ。
import { z } from "zod";
import { STYLE_NAME } from "../cards/rarity";
import type { CardStyle, ClearArea, SnowType } from "../types";
import { askJson, hasClaudeKey } from "./client";
import { SNOW_TYPE_LABEL } from "./photo";
import { estimateDepth, kgBasis, snowKgOf, type PhotoDepth } from "../snow-estimate";
import { snowComparison } from "../snowkg";

/** Claude に書いてもらうのは名前・副題・ひとことだけ */
export const CardTextSchema = z.object({
  designName: z.string(), // 例: 玄関までの三十歩
  designNameEn: z.string(), // 例: Thirty Steps to the Door
  /** 絵の中の英語のひとこと（5語まで） */
  flavor: z.string(),
});
export interface CardText extends z.infer<typeof CardTextSchema> {
  snowKg: number;
  snowKgComparison: string; // 例: 軽トラ1台分
  /** 計算の元（例: 写真から約20〜30cm × 玄関前 12m² × 重い湿り雪） */
  snowKgBasis: string;
}

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
  /** 写真から見えた雪質（v1.2）。排雪 kg の密度に使う */
  snowType?: SnowType;
  /** v1.8: 写真から読んだ雪の断面の深さと、朝の積雪深（モデル） */
  photoDepth?: PhotoDepth;
  modelDepthCm?: number;
}

/** 排雪 kg と換算と計算の元（プログラムが決める） */
export function cardSnow(input: Pick<CardTextInput, "forecastCm" | "clearArea" | "snowType" | "photoDepth" | "modelDepthCm">): Pick<CardText, "snowKg" | "snowKgComparison" | "snowKgBasis"> {
  const d = estimateDepth({ forecastCm: input.forecastCm, modelDepthCm: input.modelDepthCm, photo: input.photoDepth });
  const snowKg = snowKgOf(d.cm, input.clearArea, input.snowType);
  return { snowKg, snowKgComparison: snowComparison(snowKg), snowKgBasis: kgBasis(d, input.clearArea, input.snowType) };
}

/** 排雪 kg = 面積 × 深さ × 雪質の密度（粉雪 100 / ふつう 150 / 湿り雪 300 / 凍結 400 kg/m³）。予報の降雪量だけで計算するとき */
export function estimateSnowKg(forecastCm: number, clearArea: ClearArea, snowType: SnowType = "unknown"): number {
  return snowKgOf(forecastCm, clearArea, snowType);
}

export { snowComparison };

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
  return { designName, designNameEn, flavor, ...cardSnow(input) };
}

export async function cardText(input: CardTextInput): Promise<CardText> {
  if (!hasClaudeKey()) return mockCardText(input);
  const snow = cardSnow(input);
  const res = await askJson({
    task:
      "ありがとうカードの文字を作ってください。designName は日本語 6〜12 文字で、その時の状況（時刻・人数・雪の量・雪質・チームの混成）が伝わる詩的だが分かりやすい名前。" +
      "designNameEn は英語の副題。flavor は絵の中に入れる英語のひとこと（5語まで）。数字は input にあるものだけ。タッチの名前: " +
      STYLE_NAME[input.style],
    input: { ...input, snowKg: snow.snowKg, snowKgComparison: snow.snowKgComparison, snowType: SNOW_TYPE_LABEL[input.snowType ?? "unknown"] },
    schema: CardTextSchema,
    effort: "low",
  });
  return { ...res, ...snow };
}
