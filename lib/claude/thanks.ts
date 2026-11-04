// ありがとう点呼（spec v1.1）: お願いした人の3択を、カード裏面の一文に整える。点は付けない。
import { z } from "zod";
import { askJson, hasClaudeKey } from "./client";

export type ThanksChoice = "1" | "2" | "3";

export const THANKS_CHOICES: Record<ThanksChoice, string> = {
  "1": "ありがとう",
  "2": "助かりました",
  "3": "お茶どうぞ",
};

export const THANKS_MAX = 40;

export const ThanksSchema = z.object({
  /** カード裏面の一文（40字まで）。お宅の名前は入れない */
  sentence: z.string(),
});

export interface ThanksInput {
  label: string; // 3択の文字
  completedAtJst: string; // HH:mm
  memberCount: number;
  teamNames: string[];
  forecastCm: number;
}

export function isThanksChoice(v: string): v is ThanksChoice {
  return v === "1" || v === "2" || v === "3";
}

export function trimThanks(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, THANKS_MAX);
}

/** Claude が使えないときの一文: 3択とその朝の状況から定型 */
export function mockThanks(i: ThanksInput): string {
  const hour = Number(i.completedAtJst.split(":")[0]);
  const when = Number.isFinite(hour) ? `${hour}時台に` : "";
  const who = i.memberCount > 1 ? `${i.memberCount}人で来てくれて` : "来てくれて";
  const tail = i.label === "お茶どうぞ" ? "お茶を入れて待っています。" : i.label === "助かりました" ? "本当に助かりました。" : "ありがとうございました。";
  return trimThanks(`${when}${who}、${tail}`);
}

export async function thanksSentence(input: ThanksInput): Promise<string> {
  if (!hasClaudeKey()) return mockThanks(input);
  const res = await askJson({
    task:
      "雪かきをお願いした人が、終わったあとに3択（ありがとう／助かりました／お茶どうぞ）から1つ押しました。" +
      "その気持ちと、その朝の状況（時刻・来た人数・雪の量）を合わせて、ありがとうカードの裏面に載せる一文（40字まで、やさしい日本語、話し言葉）にしてください。" +
      "お宅の名前や人の名前は入れません。体調の話はしません。",
    input,
    schema: ThanksSchema,
    effort: "low",
    model: "light", // 短い文なので安いモデル（spec v1.6）
  });
  return trimThanks(res.sentence) || mockThanks(input);
}
