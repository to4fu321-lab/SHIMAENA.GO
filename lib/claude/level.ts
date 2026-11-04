// レベル判定: 登録の2問 → 家のレベル・必要人数・小タスク。spec 9-1。
import { z } from "zod";
import { decompose, levelFromAnswers } from "../game/mission";
import type { ClearArea, SoloMinutes } from "../types";
import { askJson, hasClaudeKey } from "./client";

export const LevelResultSchema = z.object({
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  requiredPeople: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  subtasks: z.array(
    z.object({
      kind: z.enum(["path", "sand", "dump", "garage", "road"]),
      label: z.string(),
      minutes: z.union([z.literal(10), z.literal(20), z.literal(30)]),
    }),
  ),
  /** 登録した人に返す一言（やさしい日本語） */
  message: z.string(),
});
export type LevelResult = z.infer<typeof LevelResultSchema>;

export interface LevelInput {
  soloMinutes: SoloMinutes;
  clearArea: ClearArea;
}

export function mockLevel(input: LevelInput): LevelResult {
  const level = levelFromAnswers(input.soloMinutes, input.clearArea);
  return {
    level,
    requiredPeople: level,
    subtasks: decompose(input.clearArea, level).map(({ kind, label, minutes }) => ({
      kind: kind as LevelResult["subtasks"][number]["kind"],
      label,
      minutes,
    })),
    message: `登録できました。雪の朝に1回だけ「今朝、玄関は出られそうですか？」と聞きます。`,
  };
}

export async function judgeLevel(input: LevelInput): Promise<LevelResult> {
  if (!hasClaudeKey()) return mockLevel(input);
  return askJson({
    task:
      "依頼者が登録の2問に答えました。採点表の level・requiredPeople・subtasks の規則で判定し、登録した人への一言（2文以内）を添えてください。",
    input,
    schema: LevelResultSchema,
    effort: "low",
    model: "light", // 短い文なので安いモデル（spec v1.6）
  });
}
