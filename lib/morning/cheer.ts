// 家族の応援スタンプ（spec v1.2 8）: 離れて暮らす家族が、手伝った人に1タップで応援を送る。お金や券ではない。点も付けない。
export type CheerChoice = "1" | "2" | "3";

export const CHEER_CHOICES: Record<CheerChoice, string> = {
  "1": "お疲れさま",
  "2": "あったかくして",
  "3": "遠くから拍手",
};

export function isCheerChoice(v: string): v is CheerChoice {
  return v === "1" || v === "2" || v === "3";
}

export interface CheerRecord {
  choice: CheerChoice;
  label: string;
  at: string; // ISO
  /** 伝えた相手（手伝った人）の数 */
  sentTo: number;
}

/** LINE のボタンのデータ（cheer:<missionId>=<1|2|3>）を読む */
export function parseCheer(data: string): { missionId: string; choice: CheerChoice } | null {
  const mt = /^cheer:(.+)=([123])$/.exec(data);
  return mt && isCheerChoice(mt[2]) ? { missionId: mt[1], choice: mt[2] } : null;
}
