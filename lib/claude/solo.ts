// ソロ出動のひとこと（spec v1.3）: 完了の演出と個人の活動カードに出す 30 字。本当の数字だけを渡す。キーなしは定型。
import { z } from "zod";
import { askJson, hasClaudeKey } from "./client";

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
  if (i.firstEver) return { text: "はじめの5分、おめでとう。群れの一員です。" };
  if (i.streak >= 5) return { text: `${i.streak}日連続。朝の群れの主ですね。` };
  if (i.streak >= 3) return { text: `${i.streak}日続きました。無理せずこの調子で。` };
  if (!i.onsite) return { text: "見守りも立派な出動。次は5分、外へ。" };
  return { text: "ひとりの5分が、町の冬を少し軽くしました。" };
}

export async function soloHitokoto(input: SoloHitokotoInput): Promise<{ text: string }> {
  if (!hasClaudeKey()) return mockSoloHitokoto(input);
  const res = await askJson({
    task:
      "ソロ出動を終えた人へのひとことを書いてください。採点表 solo の規則に従います: 30字まで、やさしい日本語、入力の数字だけを使う。" +
      "人の名前は出さない。体調や医療の話はしない。ほめる言葉を先に。口調は採点表 voice だが名乗らない。",
    input,
    schema: SoloHitokotoSchema,
    effort: "low",
    model: "light", // 短い文なので安いモデル（spec v1.6）
  });
  return { text: trimHitokoto(res.text) || mockSoloHitokoto(input).text };
}
