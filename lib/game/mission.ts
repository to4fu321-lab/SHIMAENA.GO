// 重要度・必要人数・小タスク分解（Claude が使えない時の予備にもなる）
import type { ClearArea, RequesterAnswer, SubTask } from "../types";

/**
 * 重要度: レベルが高いほど、「いいえ」ほど、返事がないほど上がる。
 * spec 2: 重要度＝レベル × 「いいえ」 × 返事なし
 */
export function importance(level: 1 | 2 | 3, answer: RequesterAnswer | "none"): number {
  const answerWeight = { no: 3, together: 2, yes: 1, none: 2.5 }[answer];
  return level * answerWeight;
}

/** 必要人数: レベル1=1人、2=2人、3=3人。「一緒なら」は本人が加わるので1人減らす（最低1人） */
export function requiredPeople(level: 1 | 2 | 3, answer: RequesterAnswer | "none"): number {
  if (answer === "yes") return 0;
  return Math.max(1, level - (answer === "together" ? 1 : 0));
}

const TASK = {
  path: { kind: "path", label: "玄関前の通路", minutes: 5 },
  sand: { kind: "sand", label: "階段の砂まき", minutes: 5 },
  dump: { kind: "dump", label: "雪捨て場まで1往復", minutes: 5 },
  garage: { kind: "garage", label: "車庫前", minutes: 15 },
  road: { kind: "road", label: "道路まで", minutes: 30 },
} as const satisfies Record<string, Omit<SubTask, "id">>;

/** どこまで雪かきが必要かとレベルから、5分単位の小タスクに分ける */
export function decompose(clearArea: ClearArea, level: 1 | 2 | 3): SubTask[] {
  const list: Omit<SubTask, "id">[] = [TASK.path, TASK.sand];
  if (clearArea === "garage" || clearArea === "road") list.push(TASK.garage);
  if (clearArea === "road") list.push(TASK.road);
  // 雪捨て場への往復はレベルの数だけ
  for (let i = 0; i < level; i++) list.push(TASK.dump);
  return list.map((t, i) => ({ ...t, id: `t${i + 1}` }));
}

/** 体力に関係なくいつでもある5分タスク */
export const SUPPORT_TASKS: SubTask[] = [
  { id: "scout", kind: "scout", label: "偵察（写真1枚で「ここまだ」）", minutes: 5 },
  { id: "supply", kind: "supply", label: "補給（お茶・カイロ）", minutes: 5 },
];
