// 今朝の先生（spec v1.6）: 町の先生のコツから、今朝の雪に合うものを1つ選び、言い方を残して25字に整える。
// 新しい知恵は作らない（選べなければ何も出さない）。短い文なので安いモデル。キーがないときは言葉で選ぶ。
import { z } from "zod";
import type { Tip } from "../morning/tips";
import { askJson, hasClaudeKey } from "./client";

export const TEACHER_MAX = 25;

export interface TeacherInput {
  cm: number;
  tempMinC?: number;
  tips: Tip[];
}

/** 雪の様子に合う言葉（キーなしの選び方） */
function wanted(i: TeacherInput): RegExp {
  if (i.tempMinC !== undefined && i.tempMinC <= -5) return /凍|滑|すべ|砂|氷|つる/;
  if (i.cm >= 15) return /重|少しずつ|ちょっと|休|朝のうち|早め/;
  return /朝のうち|早め|スコップ|ロウ|押す|道/;
}

const short = (t: string) => ([...t].length <= TEACHER_MAX ? t : `${[...t].slice(0, TEACHER_MAX - 1).join("")}…`);

export function mockTeacher(i: TeacherInput): { tipId: string; line: string } | undefined {
  if (i.tips.length === 0) return undefined;
  const re = wanted(i);
  const tip = [...i.tips].reverse().find((t) => re.test(t.text)) ?? i.tips.at(-1)!;
  return { tipId: tip.id, line: short(tip.text) };
}

export async function pickTeacher(i: TeacherInput): Promise<{ tipId: string; line: string } | undefined> {
  if (i.tips.length === 0) return undefined;
  if (!hasClaudeKey()) return mockTeacher(i);
  const recent = i.tips.slice(-30);
  const res = await askJson({
    task:
      `町の先生（雪かきをお願いする側の方々）が教えてくれたコツから、今朝の雪に一番合うものを1つ選び、${TEACHER_MAX}字までに整えてください。` +
      "言い方は先生の言葉をなるべく残す。新しい知恵を足さない。名前や場所は書かない。危ないこと（屋根に登る等）を勧めるコツは選ばない。合うものがなければ tipId を空にする。",
    input: { snow: { cm: i.cm, tempMinC: i.tempMinC ?? null }, tips: recent.map((t) => ({ id: t.id, text: t.text })) },
    schema: z.object({ tipId: z.string(), line: z.string() }),
    effort: "low",
    model: "light",
  });
  if (!recent.some((t) => t.id === res.tipId) || !res.line.trim()) return undefined;
  return { tipId: res.tipId, line: short(res.line.trim()) };
}
