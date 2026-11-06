// 前夜の予告（spec 2: 司令官が「明朝 6:30 に点呼。予想 12cm。長靴と手袋を」）。
// v1.1: 今朝の雪に名前をつける（雪ボス）。地図の雪HPバーに出す。採点表 snowName の規則。
// v1.30: 白いもの（大福・ソフトクリーム・シマエナガ・オコジョ…）で、毎朝ちがう名前に。
import { z } from "zod";
import { askJson, hasClaudeKey } from "./client";

export const SNOW_NAME_MAX = 10;

/**
 * 今朝の雪の名前の候補（spec v1.30）: 白いもの（食べもの・北海道の生きもの）に、雪の手ごたえのことばを付ける。
 * 雪の量で4つに分ける。毎朝ちがうものが出るように、日付（と押した時刻）で選ぶ。
 */
export const SNOW_NAMES: Record<"light" | "medium" | "heavy" | "huge", string[]> = {
  // 8cm 未満: 軽い・小さい
  light: ["ふわふわ綿あめ", "さらさら粉砂糖", "ちいさなシマエナガ", "ふんわりマシュマロ", "ひらひらメレンゲ", "こっそりオコジョ", "ぴょんとユキウサギ", "ふわっと生クリーム", "ちょこんと白玉"],
  // 8〜14cm: ふつう
  medium: ["もっちり大福", "とろりソフトクリーム", "ぷるぷる杏仁豆腐", "まんまるシマエナガ", "ころころ白玉", "しっとりはんぺん", "きらきらかき氷", "のんびりオコジョ", "すいすいオショロコマ", "ほかほか肉まん"],
  // 15〜24cm: 重い
  heavy: ["どっしり鏡もち", "ずっしりお餅", "もりもりかき氷", "のっしりシロクマ", "でっかい大福", "むっちりマシュマロ", "ゆうゆうタンチョウ", "ぎっしり白米", "ばさりシロフクロウ"],
  // 25cm 以上: とても重い（親玉）
  huge: ["特大ソフトクリーム", "山盛りかき氷", "巨大鏡もち", "親分シロクマ", "横綱大福", "大群シマエナガ", "超特盛り白米"],
};

function sizeOf(forecastCm: number): keyof typeof SNOW_NAMES {
  if (forecastCm < 8) return "light";
  if (forecastCm < 15) return "medium";
  if (forecastCm < 25) return "heavy";
  return "huge";
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Claude が使えないときの名前: 雪の量の組から、seed（日付など）で1つ選ぶ */
export function mockSnowName(forecastCm: number, seed = ""): string {
  const list = SNOW_NAMES[sizeOf(forecastCm)];
  return list[hash(`${seed}|${forecastCm}`) % list.length];
}

/** Claude に渡す候補: 雪の量の組から4つ、ほかの組から2つ（毎回ちがう） */
export function snowNameHints(forecastCm: number, seed = ""): string[] {
  const own = SNOW_NAMES[sizeOf(forecastCm)];
  const others = Object.entries(SNOW_NAMES).filter(([k]) => k !== sizeOf(forecastCm)).flatMap(([, v]) => v);
  const pick = (list: string[], n: number, salt: string) =>
    [...list].sort((x, y) => hash(seed + salt + x) - hash(seed + salt + y)).slice(0, n);
  return [...pick(own, 4, "a"), ...pick(others, 2, "b")];
}

export const AnnounceSchema = z.object({
  text: z.string(),
  /** 今朝の雪の名前（10字まで）。例: もっちり大福・とろりソフトクリーム・まんまるシマエナガ */
  snowName: z.string(),
});
export type Announcement = z.infer<typeof AnnounceSchema>;

export interface AnnounceInput {
  date: string; // 点呼の朝（YYYY-MM-DD）
  forecastCm: number;
  /** 名前を毎回変えるための種（/admin の練習で同じ日を何度もやるときは押した時刻）。省くと日付 */
  seed?: string;
}

export function mockAnnounce(input: AnnounceInput): Announcement {
  const snowName = mockSnowName(input.forecastCm, input.seed ?? input.date);
  return {
    snowName,
    text: `シマエナ隊長だしま〜！明朝は ${input.forecastCm}cm の予報、相手は「${snowName}」。10cm 以上積もったら、6:30 に近所の雪かき応援をお知らせするえな〜！長靴と手袋を。`,
  };
}

/** 名前を 8 字に収める。空なら定型に */
export function trimSnowName(name: string, forecastCm: number, seed = ""): string {
  const t = name.replace(/[「」『』\s]/g, "").slice(0, SNOW_NAME_MAX);
  return t || mockSnowName(forecastCm, seed);
}

export async function announceText(input: AnnounceInput): Promise<Announcement> {
  if (!hasClaudeKey()) return mockAnnounce(input);
  const res = await askJson({
    task:
      "前夜の予告を書いてください。snowName は採点表 snowName の規則で、明朝の雪につける名前（10文字まで）。input.hints の候補から雪の量に合うものを選ぶか、同じ考え方（白いもの＋手ごたえのことば）で新しく作ります。" +
      "text は採点表 voice のシマエナ隊長の口調で4文以内、やさしい日本語。最初に「シマエナ隊長だしま〜！」と名乗り、10cm 以上積もったら明朝 6:30 に近所の雪かき応援をお知らせすること、予想の降雪量（cm）、相手の名前（「相手は『名前』」の形）、持ち物（長靴・手袋など）を入れます。体調の話はしません。",
    input: { date: input.date, forecastCm: input.forecastCm, hints: snowNameHints(input.forecastCm, input.seed ?? input.date) },
    schema: AnnounceSchema,
    effort: "low",
    model: "light", // 短い文なので安いモデル（spec v1.6）
  });
  return { text: res.text, snowName: trimSnowName(res.snowName, input.forecastCm, input.seed ?? input.date) };
}
