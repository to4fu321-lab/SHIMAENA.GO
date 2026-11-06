// ありがとう点呼（spec v1.1・v1.29）: お願いした人の3択を、そのままカード裏面に入れる。点は付けない。
// v1.29 から Claude は使わない（ThanksSchema と mockThanks は前の版の記録とテストのために残す）。
import { z } from "zod";

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

/**
 * カード裏面に入れる文（spec v1.29）: 家の人が押したことばを、そのまま「」に入れる。
 * 気持ちを伝えるところは AI に書かせない（本人の決定）。気持ちを足したいときは「声のありがとう」で。
 */
export async function thanksSentence(input: ThanksInput): Promise<string> {
  return trimThanks(`「${input.label}」`);
}
