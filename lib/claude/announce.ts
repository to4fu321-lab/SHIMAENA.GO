// 前夜の予告（spec 2: 司令官が「明朝 6:30 に点呼。予想 12cm。長靴と手袋を」）。
// v1.1: 今朝の雪に名前をつける（雪ボス）。地図の雪HPバーに出す。採点表 snowName の規則。
import { z } from "zod";
import { askJson, hasClaudeKey } from "./client";

export const SNOW_NAME_MAX = 8;

export const AnnounceSchema = z.object({
  text: z.string(),
  /** 今朝の雪の名前（8字まで）。例: ぼた雪のドンブリ */
  snowName: z.string(),
});
export type Announcement = z.infer<typeof AnnounceSchema>;

export interface AnnounceInput {
  date: string; // 点呼の朝（YYYY-MM-DD）
  forecastCm: number;
}

/** Claude が使えないときの名前: 降雪量から定型 */
export function mockSnowName(forecastCm: number): string {
  if (forecastCm < 8) return "こな雪のフワリ";
  if (forecastCm < 15) return "ぼた雪のドンブリ";
  if (forecastCm < 25) return "どか雪のモッサリ";
  return "大雪のドッシリ";
}

export function mockAnnounce(input: AnnounceInput): Announcement {
  const snowName = mockSnowName(input.forecastCm);
  return {
    snowName,
    text: `シマエナ隊長だしま〜！明朝 6:30 に点呼します。予想は ${input.forecastCm}cm、相手は「${snowName}」。長靴と手袋を忘れずにえな〜！`,
  };
}

/** 名前を 8 字に収める。空なら定型に */
export function trimSnowName(name: string, forecastCm: number): string {
  const t = name.replace(/[「」『』\s]/g, "").slice(0, SNOW_NAME_MAX);
  return t || mockSnowName(forecastCm);
}

export async function announceText(input: AnnounceInput): Promise<Announcement> {
  if (!hasClaudeKey()) return mockAnnounce(input);
  const res = await askJson({
    task:
      "前夜の予告を書いてください。snowName は採点表 snowName の規則で、明朝の雪につける名前（8文字まで）。" +
      "text は採点表 voice のシマエナ隊長の口調で4文以内、やさしい日本語。最初に「シマエナ隊長だしま〜！」と名乗り、明朝 6:30 に点呼があること、予想の降雪量（cm）、相手の名前（「相手は『名前』」の形）、持ち物（長靴・手袋など）を入れます。体調の話はしません。",
    input,
    schema: AnnounceSchema,
    effort: "low",
    model: "light", // 短い文なので安いモデル（spec v1.6）
  });
  return { text: res.text, snowName: trimSnowName(res.snowName, input.forecastCm) };
}
