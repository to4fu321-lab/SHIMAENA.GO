// 週末: 「今週の群れ」の実況文（spec 9-5）。称号とシャッフルは計算（lib/game/week.ts）、文章だけ Claude。
import { z } from "zod";
import type { WeeklySummary } from "../game/week";
import { TEAMS } from "../teams";
import { askJson, hasClaudeKey } from "./client";

export const WeeklyTextSchema = z.object({
  /** 町内みんなに送る実況（3〜5文、やさしい日本語） */
  commentary: z.string(),
  /** 来週に向けたひとこと（1文） */
  nextWeek: z.string(),
});
export type WeeklyText = z.infer<typeof WeeklyTextSchema>;

const teamName = (id: string) => TEAMS.find((t) => t.id === id)?.name ?? id;

export function mockWeeklyText(w: WeeklySummary): WeeklyText {
  const rank = w.ranking.map((t, i) => `${i + 1}位 ${teamName(t)} ${w.teamTotals[t]}点`).join("、");
  const titles = w.titles.length > 0 ? `称号は ${w.titles.map((t) => `${t.nickname}さん「${t.title}」`).join("、")}。` : "";
  const goal = w.goalTeams.length > 0 ? `${w.goalTeams.map(teamName).join("と")}は全部の家を8時までに終えて、週の目標ボーナス。` : "";
  return {
    commentary: `エナガ隊長です。今週の群れ: 雪の朝は${w.days}回、${w.missionsDone}軒の玄関をあけました。${rank}。${goal}${titles}`.trim(),
    nextWeek: "来週はチームを組み直します。新しい仲間と、くっついて乗り切りましょう。",
  };
}

export async function weeklyText(w: WeeklySummary): Promise<WeeklyText> {
  if (!hasClaudeKey()) return mockWeeklyText(w);
  return askJson({
    task:
      "日曜の夜に町内みんなへ送る「今週の群れ」の実況を書いてください。commentary は3〜5文で、雪の朝の回数・終えた家の数・チーム順位（個人順位は出さない）・称号の人・週の目標を達成したチームを、やさしい日本語で。" +
      "口調は採点表 voice のエナガ隊長で、最初に「エナガ隊長です。」と名乗る。nextWeek は来週に向けた1文（チームを組み直すことに触れる）。",
    input: { ...w, teamNames: Object.fromEntries(TEAMS.map((t) => [t.id, t.name])) },
    schema: WeeklyTextSchema,
    effort: "low",
  });
}
