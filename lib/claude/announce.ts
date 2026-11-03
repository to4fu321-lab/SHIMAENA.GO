// 前夜の予告（spec 2: 司令官が「明朝 6:30 に点呼。予想 12cm。長靴と手袋を」）。
import { z } from "zod";
import { askJson, hasClaudeKey } from "./client";

export const AnnounceSchema = z.object({ text: z.string() });

export interface AnnounceInput {
  date: string; // 点呼の朝（YYYY-MM-DD）
  forecastCm: number;
}

export function mockAnnounce(input: AnnounceInput): string {
  return `明朝 6:30 に点呼します。予想 ${input.forecastCm}cm。長靴と手袋を。`;
}

export async function announceText(input: AnnounceInput): Promise<string> {
  if (!hasClaudeKey()) return mockAnnounce(input);
  const res = await askJson({
    task: "前夜の予告を書いてください。2文以内、やさしい日本語。明朝 6:30 に点呼があること、予想の降雪量（cm）、持ち物（長靴・手袋など）を入れます。体調の話はしません。",
    input,
    schema: AnnounceSchema,
    effort: "low",
  });
  return res.text;
}
