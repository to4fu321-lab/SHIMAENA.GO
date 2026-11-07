// 今朝の実況（spec v1.1 9-6）: 本当の集計だけを渡して、Claude が3〜4文にする。数字は作らせない。
import { z } from "zod";
import type { RecapInput } from "../morning/recap";
import { askJson, hasClaudeKey } from "./client";

export const RecapSchema = z.object({
  /** 3〜4文、やさしい日本語。渡された数字だけを使う */
  text: z.string(),
});
export type Recap = z.infer<typeof RecapSchema>;

const md = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}月${d}日`;
};

/** Claude が使えないときの実況: 渡された数字だけで組み立てる */
export function mockRecap(i: RecapInput): Recap {
  // 3〜4文に収める: 雪の様子 → 出撃 → 結果（合流・駆けつけはかっこの中） → ねぎらい
  const extras: string[] = [];
  if (i.mixedHouses > 0) extras.push(`2チームの合流が${i.mixedHouses}軒`);
  if (i.rescues > 0) extras.push(`駆けつけが${i.rescues}回`);
  if (i.fiveMinuteJoins > 0) extras.push(`10分の偵察・補給が${i.fiveMinuteJoins}回`);
  const note = extras.length > 0 ? `（${extras.join("、")}）` : "";
  const parts: string[] = [];
  parts.push(`シマエナ隊長だしま〜！${md(i.date)}、${i.townName}に${i.forecastCm}cmの雪${i.snowName ? `、相手は「${i.snowName}」` : ""}。`);
  if (i.movers > 0) parts.push(`${i.startTime}、${i.teamsOut}つの群れが出撃し、${i.movers}人が動きました。`);
  if (i.allDone) {
    parts.push(`${i.lastDoneAt ? `${i.lastDoneAt}に` : ""}${i.housesDone}軒すべての玄関が開き、討伐です${note}。`);
  } else if (i.housesDone > 0) {
    parts.push(`${i.housesDone}軒の玄関が開きました${i.shortRemaining > 0 ? `。人手が足りない家があと${i.shortRemaining}軒` : ""}${note}。`);
  } else {
    parts.push("まだ最初の家は終わっていません。");
  }
  parts.push("今日も、エリアの冬が少し軽くなりました。");
  return { text: parts.join("") };
}

export async function recapText(input: RecapInput): Promise<Recap> {
  if (!hasClaudeKey()) return mockRecap(input);
  const res = await askJson({
    task:
      "今朝のエリアの雪かきの実況を書いてください。採点表 recap の規則に従います: 3〜4文、やさしい日本語、入力の数字だけを使い、入力にない数字や出来事は書かない。" +
      "人の名前は出さない。体調や医療の話はしない。最後の1文はエリアへのねぎらい。口調は採点表 voice のシマエナ隊長で、最初に「シマエナ隊長だしま〜！」と名乗る。",
    input,
    schema: RecapSchema,
    effort: "low",
  });
  return { text: res.text.trim() || mockRecap(input).text };
}
