// ソロ出動のひとこと（spec v1.3）: 完了の演出と個人の活動カードに出す 30 字。11/18 本人の指示「不要な API をプログラムに」で、定型だけにした（Claude は呼ばない）。
import { z } from "zod";

export const HITOKOTO_MAX = 30;

export const SoloHitokotoSchema = z.object({ text: z.string() });

export interface SoloHitokotoInput {
  label: string; // ミッション名
  onsite: boolean;
  feathers: number; // いま入った羽
  todayFeathers: number;
  totalFeathers: number;
  streak: number;
  firstEver: boolean;
}

export function trimHitokoto(s: string | undefined): string {
  return (s ?? "").replace(/\s+/g, " ").trim().slice(0, HITOKOTO_MAX);
}

export function mockSoloHitokoto(i: SoloHitokotoInput): { text: string } {
  if (i.firstEver) return { text: "はじめの10分、おめでとう。群れの一員です。" };
  if (i.streak >= 5) return { text: `${i.streak}日連続。朝の群れの主ですね。` };
  if (i.streak >= 3) return { text: `${i.streak}日続きました。無理せずこの調子で。` };
  if (!i.onsite) return { text: "見守りも立派な出動。次は10分、外へ。" };
  return { text: "ひとりの10分が、町の冬を少し軽くしました。" };
}

/** ひとこと（11/18 本人の指示でプログラムの定型に。Claude は呼ばない） */
export async function soloHitokoto(input: SoloHitokotoInput): Promise<{ text: string }> {
  return mockSoloHitokoto(input);
}
