// 排雪 kg の見せ方（画面と Claude の両方から使う。SDK に依存しない）
export function snowComparison(kg: number): string {
  if (kg < 100) return "米袋3つ分";
  if (kg < 300) return "大人4人分";
  if (kg < 700) return "軽トラ半分";
  if (kg < 1200) return "軽トラ1台分";
  if (kg < 2000) return "軽トラ2台分";
  if (kg < 4000) return "小型トラック1台分";
  if (kg < 10000) return "小型トラック2〜3台分";
  return "大型トラック1台分";
}

/** 1200 → "1.2t"、800 → "800kg" */
export function formatKg(kg: number): string {
  if (kg >= 1000) return `${(Math.round(kg / 100) / 10).toFixed(1).replace(/\.0$/, "")}t`;
  return `${Math.round(kg)}kg`;
}
