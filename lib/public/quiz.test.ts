import { describe, expect, it } from "vitest";
import { mockQuizComment, quizComment } from "../claude/quiz";
import { svgToPng } from "../cards/png";
import { quizCardData, renderShareSvg } from "../sns/cards";
import { isQuizType, QUIZ_QUESTIONS, QUIZ_TYPES, quizResult, type QuizType } from "./quiz";

describe("シマエナ診断", () => {
  it("5問で、はい の質問のタイプになる", () => {
    expect(QUIZ_QUESTIONS).toHaveLength(5);
    QUIZ_QUESTIONS.forEach((q, i) => {
      const a = [0, 0, 0, 0, 0] as (0 | 1 | 2)[];
      a[i] = 2;
      expect(quizResult(a)).toBe(q.main);
    });
  });

  it("全部いいえは応援シマエナ、全部はいは固定の順で決まる（毎回同じ）", () => {
    expect(quizResult([0, 0, 0, 0, 0])).toBe("ouen");
    const all = quizResult([2, 2, 2, 2, 2]);
    expect(quizResult([2, 2, 2, 2, 2])).toBe(all);
    expect(isQuizType(all)).toBe(true);
  });

  it("5タイプすべてに出会える", () => {
    const seen = new Set<QuizType>();
    const vals = [0, 1, 2] as const;
    for (const a of vals) for (const b of vals) for (const c of vals) for (const d of vals) for (const e of vals) seen.add(quizResult([a, b, c, d, e]));
    expect([...seen].sort()).toEqual(Object.keys(QUIZ_TYPES).sort());
  });

  it("結果カードが3サイズで描け、キーなしのひとことは定型", async () => {
    for (const f of ["square", "story", "og"] as const) {
      const svg = renderShareSvg(quizCardData("kotsu", "example.com/public/diagnosis", "しらかばエリア"), f);
      expect(svg).toContain("コツコツシマエナ");
    }
    const png = await svgToPng(renderShareSvg(quizCardData("asa", "x", "y"), "og"), { width: 1200 });
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    if (process.env.ANTHROPIC_API_KEY) return;
    expect(await quizComment("asa", "2026-12-14")).toEqual({ text: mockQuizComment("asa"), byClaude: false });
  });
});
