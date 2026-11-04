// 安全のひとこと（spec v1.6）: 大雪・低温・強風の朝は、隊長が必ず安全の一文を言う。
// 出すかどうかは天気の数字だけで決める（AI は使わない）。言い方も定型（体調の判断はしない・丁寧語）。

export const SAFETY = { heavyCm: 15, coldC: -5, windMs: 8 } as const;

export interface SafetyInput {
  cm: number;
  /** 朝までの最低気温（℃）。分からなければ undefined */
  tempMinC?: number;
  /** 朝までの最大の風（m/s）。分からなければ undefined */
  windMaxMs?: number;
}

export type SafetyReason = "heavy" | "cold" | "wind";

/** 当てはまる理由（重い順）。何もなければ空 */
export function safetyReasons(i: SafetyInput): SafetyReason[] {
  const out: SafetyReason[] = [];
  if (i.cm >= SAFETY.heavyCm) out.push("heavy");
  if (i.tempMinC !== undefined && i.tempMinC <= SAFETY.coldC) out.push("cold");
  if (i.windMaxMs !== undefined && i.windMaxMs >= SAFETY.windMs) out.push("wind");
  return out;
}

/** 安全の一文。いつも「ひとりでやらない」と「休む」のどちらかが入る。必要ない朝は undefined */
export function safetyLine(i: SafetyInput): string | undefined {
  const r = safetyReasons(i);
  if (r.length === 0) return undefined;
  const head =
    r[0] === "heavy"
      ? "重い雪の朝です。"
      : r[0] === "cold"
        ? `とても冷える朝です（${Math.round(i.tempMinC!)}℃）。`
        : `風が強い朝です（${Math.round(i.windMaxMs!)}m/s）。屋根の下には近づかないでください。`;
  return `⚠️ ${head}ひとりでやらず、15分ごとに休みましょう。無理せず、休むのも大事な仕事です。`;
}
