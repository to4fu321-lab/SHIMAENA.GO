// SNS の投稿文の下書き（spec v1.3）。集計の数字だけを Claude に渡す。数字を作っていたら定型に戻す。キーなしは定型。
import { z } from "zod";
import type { PublicStats } from "../public/stats";
import { clampShareText, mockShareText, type ShareKind } from "../sns/text";
import { askJson, hasClaudeKey } from "./client";

export const ShareTextSchema = z.object({ text: z.string() });

/** 町の投稿文の種類（本人の活動 me は本人の画面で作るので、ここでは扱わない） */
export type TownShareKind = Exclude<ShareKind, "me">;
export const TOWN_SHARE_KINDS: TownShareKind[] = ["today", "town", "recruit"];

const LABEL: Record<TownShareKind, string> = {
  today: "今日の出動（今日もシマエナGO 出動）",
  town: "町の雪解け（今週の町の変化）",
  recruit: "仲間の募集（あと1人で救える家・5分だけ参加）",
};

/** 種類ごとに Claude に渡す数字（ここにない数字は書かせない） */
export function shareInput(kind: TownShareKind, st: PublicStats) {
  const common = { kind: LABEL[kind], townName: st.townName, snowName: st.snowName ?? null };
  switch (kind) {
    case "today":
      return { ...common, todayPeople: st.todayPeople, todayMissions: st.todayMissions, housesDone: st.housesDone, housesTotal: st.housesTotal, housesLeft: st.left };
    case "town":
      return { ...common, thawPct: st.thawPct, weekPeople: st.week.people, weekHousesDone: st.week.housesDone, weekDays: st.week.days };
    case "recruit":
      return { ...common, shortHouses: st.shortHouses, shortMissingMin: st.shortMissingMin, todayPeople: st.todayPeople };
  }
}

/** 数字が変わったら作り直すための鍵 */
export function shareKey(kind: TownShareKind, st: PublicStats): string {
  return `${kind}:${JSON.stringify(shareInput(kind, st))}`;
}

const toHalf = (s: string) => s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));

/** 文の中の数字が、渡した数字（と「5分」の 5）だけかを確かめる */
export function usesOnlyGivenNumbers(text: string, input: Record<string, unknown>): boolean {
  const allowed = new Set<string>(["5"]);
  for (const v of Object.values(input)) for (const n of String(v ?? "").match(/\d+/g) ?? []) allowed.add(n);
  return (toHalf(text).match(/\d+/g) ?? []).every((n) => allowed.has(n));
}

export function finishShareText(raw: string): string {
  let t = raw.replace(/\r/g, "").trim();
  if (!t.includes("#シマエナGO")) t = `${t}\n#シマエナGO`;
  return clampShareText(t);
}

export async function shareText(kind: TownShareKind, st: PublicStats): Promise<{ text: string; byClaude: boolean }> {
  const mock = { text: mockShareText(kind, st), byClaude: false };
  if (!hasClaudeKey()) return mock;
  const input = shareInput(kind, st);
  const res = await askJson({
    task:
      "町内の雪かきゲームの、SNS に投稿する文の下書きを書いてください。採点表 share の規則に従います: 115字以内、2〜4行、入力の数字だけ、名前や家は書かない、" +
      "最後は #シマエナGO と #5分だけ出動 か #雪解け。名乗らない。読んだ人が5分だけ参加したくなる一文で終える。",
    input,
    schema: ShareTextSchema,
    effort: "low",
    model: "light", // 短い文なので安いモデル（spec v1.6）
  });
  const text = finishShareText(res.text);
  if (!text || !usesOnlyGivenNumbers(text, input)) return mock;
  return { text, byClaude: true };
}
