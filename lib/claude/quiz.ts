// シマエナ診断のひとこと（spec v1.3）。タイプごとに1日1回だけ Claude に書いてもらい、保存して使い回す（開くたびには呼ばない）。
import { z } from "zod";
import { QUIZ_TYPES, type QuizType } from "../public/quiz";
import { loadShareTexts, saveShareText } from "../sns/store";
import { askJson, hasClaudeKey } from "./client";
import { appNow } from "@/lib/clock";

export const QUIZ_COMMENT_MAX = 40;
export const QuizCommentSchema = z.object({ text: z.string() });

export function mockQuizComment(type: QuizType): string {
  const t = QUIZ_TYPES[type];
  return `${t.name}のあなたへ。まずは「${t.mission}」から、10分だけどうぞ。`.slice(0, QUIZ_COMMENT_MAX + 10);
}

export async function quizComment(type: QuizType, today: string): Promise<{ text: string; byClaude: boolean }> {
  if (!hasClaudeKey()) return { text: mockQuizComment(type), byClaude: false };
  const key = `quiz-${type}`;
  const stored = (await loadShareTexts())[key];
  if (stored?.key === today) return { text: stored.text, byClaude: stored.byClaude };
  try {
    const t = QUIZ_TYPES[type];
    const res = await askJson({
      task:
        "雪かきゲーム「シマエナGO」のシマエナ診断の結果に添えるひとことを書いてください。採点表 quiz の規則に従います: 40字まで、やさしい日本語、" +
        "タイプの良いところをほめて、おすすめの10分の出動に誘う。性格を決めつけない。名乗らない。",
      input: { typeName: t.name, catchphrase: t.catchphrase, mission: t.mission },
      schema: QuizCommentSchema,
      effort: "low",
    model: "light", // 短い文なので安いモデル（spec v1.6）
    });
    const text = res.text.replace(/\s+/g, " ").trim().slice(0, QUIZ_COMMENT_MAX) || mockQuizComment(type);
    await saveShareText(key, { text, key: today, at: appNow().toISOString(), byClaude: true });
    return { text, byClaude: true };
  } catch (e) {
    console.error("[quiz]", e instanceof Error ? e.message : e);
    return { text: mockQuizComment(type), byClaude: false };
  }
}
