// 暦の話題（spec v1.23）: 二十四節気と年中行事。Claude のキーがないとき・Web の話題が取れないときに使う（プログラムだけで決まる）。
// 日付は毎年ほぼ同じ日（節気は ±1 日ずれる年があるが、カードの話題には十分）。

export interface CalendarTopic {
  /** カードに出す名前（10字まで） */
  label: string;
  /** 挿絵の手がかり（決まった絵の種類） */
  motif: MotifHint;
}

/** キーなしの挿絵（lib/cards/motif.ts のプログラムの絵）の種類 */
export type MotifHint = "crystal" | "yuzu" | "tree" | "bell" | "kadomatsu" | "mochi" | "oni" | "heart" | "hina" | "lantern" | "leaf" | "moon";

// [月, 日, 名前, 絵]。節気は前後 3 日、行事は当日と前日に出す
const SEKKI: [number, number, string, MotifHint][] = [
  [1, 5, "小寒", "crystal"],
  [1, 20, "大寒", "crystal"],
  [2, 4, "立春", "leaf"],
  [2, 19, "雨水", "leaf"],
  [3, 5, "啓蟄", "leaf"],
  [3, 20, "春分", "leaf"],
  [10, 23, "霜降", "leaf"],
  [11, 7, "立冬", "crystal"],
  [11, 22, "小雪", "crystal"],
  [12, 7, "大雪", "crystal"],
  [12, 22, "冬至", "yuzu"],
];

const EVENTS: [number, number, string, MotifHint][] = [
  [11, 15, "七五三", "lantern"],
  [11, 23, "勤労感謝の日", "leaf"],
  [12, 13, "すす払い", "crystal"],
  [12, 24, "クリスマスイブ", "tree"],
  [12, 25, "クリスマス", "bell"],
  [12, 31, "大晦日", "moon"],
  [1, 1, "お正月", "kadomatsu"],
  [1, 2, "書き初め", "kadomatsu"],
  [1, 7, "七草", "leaf"],
  [1, 11, "鏡開き", "mochi"],
  [1, 15, "小正月", "mochi"],
  [2, 3, "節分", "oni"],
  [2, 14, "バレンタイン", "heart"],
  [3, 3, "ひなまつり", "hina"],
];

const md = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return { m, d };
};

/** その日の前後で、日付の差（同じ年の中で、ざっくり 31 日の月として） */
const gap = (a: { m: number; d: number }, m: number, d: number) => Math.abs((a.m - m) * 31 + (a.d - d));

/** その日の暦の話題（近い順。なければ季節のひとこと） */
export function calendarTopics(ymd: string): CalendarTopic[] {
  const day = md(ymd);
  const out: { t: CalendarTopic; g: number }[] = [];
  for (const [m, d, label, motif] of EVENTS) {
    const g = (day.m === m && (day.d === d || day.d === d - 1)) ? Math.abs(day.d - d) : 99;
    if (g < 99) out.push({ t: { label, motif }, g });
  }
  for (const [m, d, label, motif] of SEKKI) {
    const g = gap(day, m, d);
    if (g <= 3) out.push({ t: { label, motif }, g: g + 0.5 });
  }
  out.sort((a, b) => a.g - b.g);
  if (out.length > 0) return out.map((x) => x.t);
  const season = day.m === 12 || day.m <= 2 ? "真冬の朝" : day.m <= 4 ? "春を待つ朝" : "初冬の朝";
  return [{ label: season, motif: "crystal" }];
}
