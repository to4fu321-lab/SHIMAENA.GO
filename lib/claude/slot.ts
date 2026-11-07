// チームで時間をそろえる（spec v1.41・採点表 slot）: 隊長の誘いの一文。そろう帯と人数はプログラム（lib/calendar/slots.ts）が決める。
// 選んだときだけ呼ぶ（チームごとに1つ朝の記録に残して、みんなで使い回す）。点検に通らなければ決まった文。
import { z } from "zod";
import { askJson, hasClaudeKey } from "./client";
import { aiLineOk } from "../nakama/rules";
import { slotLineNumbers, slotOf, templateSlotLine } from "../calendar/slots";
import type { HelperWhen } from "../types";

const LineSchema = z.object({ text: z.string() });
export const SLOT_LINE_MAX = 40;

export async function slotLine(input: { teamName: string; when: HelperWhen; count: number }): Promise<string> {
  const fallback = templateSlotLine(input.teamName, input.when, input.count);
  if (!hasClaudeKey()) return fallback;
  const s = slotOf(input.when);
  try {
    const res = await askJson({
      task:
        "チームのなかまが雪かきに来る時間をそろえる、誘いの一文を書いてください。採点表 slot の規則に従います: 40字まで、やさしい日本語、シマエナ隊長の明るい口調（名乗らない）。" +
        "そろう時間と人数はもう決まっています（入力のとおり）。チーム名・帯（朝／お昼／夕方）・集まる時刻・人数を入れて、ほかの人も同じ時間に来たくなるように。" +
        "断ってもよいことが伝わる言い方。人の名前・家の場所は書かない。入力にない数字は書かない。",
      input: { teamName: input.teamName, band: s.label, meetTime: `${Number(s.meet.slice(0, 2))}:${s.meet.slice(3)}`, people: input.count },
      schema: LineSchema,
      effort: "low",
      model: "light",
    });
    return aiLineOk(res.text, SLOT_LINE_MAX, slotLineNumbers(input.when, input.count)) ? res.text.trim() : fallback;
  } catch (e) {
    console.error("[slot] 時間合わせの一文を書けませんでした:", e instanceof Error ? e.message : e);
    return fallback;
  }
}
