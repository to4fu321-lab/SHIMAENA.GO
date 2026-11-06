// 隊長の声かけの文（spec v1.18）: しばらく活動のない人へ、その人の方向と本当の記録から2文。採点表 nudge。
// 「来て」ではなく「雪の便り」。参加しないことを責めない。体調に触れない。呼び名だけ。キーなしは定型。
import { z } from "zod";
import { MOTIVE_LABEL, type Motive } from "../concierge/profile";
import { askJson, hasClaudeKey } from "./client";

export const NudgeSchema = z.object({
  /** 2文（1文ずつ） */
  lines: z.array(z.string()),
});

export interface NudgeInput {
  nickname: string;
  /** 最後の活動から何日（はじめてなら null） */
  daysSince: number | null;
  motives: Motive[];
  summary: string;
  feathers: number;
  cards: number;
  teamName?: string;
  /** 今週の町: 雪の朝の回数・終えた家の数 */
  week: { days: number; housesDone: number };
  /** すすめる候補 */
  option: { title: string; minutes: number; points: number };
}

export const LINE_MAX = 50;
const BODY = /病院|病気|通院|薬|腰|膝|体調|具合|痛|熱|手術|血圧|心臓|しんどい|元気ですか|大丈夫ですか/;

export function mockNudge(i: NudgeInput): string[] {
  const first = i.daysSince === null ? `${i.nickname}さん、はじめての10分はいつでも待ってるしま〜！` : `${i.nickname}さん、雪の便りだしま〜。今週は雪の朝が${i.week.days}回、${i.week.housesDone}軒の玄関があきました。`;
  const motive = i.motives[0] ? `${MOTIVE_LABEL[i.motives[0]]}が好きな${i.nickname}さんに、` : "";
  return [first, `${motive}${i.option.title}（${i.option.minutes}分）はどうえな〜？`.replace(/^、/, "")];
}

/** 2文・1文50字・体のことばなし にそろえる */
export function tidyNudge(lines: string[], i: NudgeInput): string[] {
  const ok = lines.map((l) => l.replace(/\s+/g, " ").trim().slice(0, LINE_MAX)).filter((l) => l && !BODY.test(l));
  return ok.length >= 1 ? ok.slice(0, 2) : mockNudge(i);
}

export async function nudgeLines(i: NudgeInput): Promise<string[]> {
  if (!hasClaudeKey()) return mockNudge(i);
  try {
    const res = await askJson({
      task:
        "しばらく活動のない人への、シマエナ隊長の声かけを書いてください（採点表 nudge）。lines は2文（1文50字まで）。" +
        "1文目は呼び名と「雪の便り」（今週の町の数字か、その人のカード・羽など input の事実だけ）。2文目は option を、その人の方向（motives）に結びつけてやさしくすすめる。来てほしいと頼まない。参加しないことを責めない。体調に触れない。口調は採点表 voice。",
      input: i,
      schema: NudgeSchema,
      effort: "low",
      model: "light",
    });
    return tidyNudge(res.lines, i);
  } catch (e) {
    console.error("[nudge] Claude が使えないので定型で:", e instanceof Error ? e.message : e);
    return mockNudge(i);
  }
}
