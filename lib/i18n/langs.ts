// 多言語（spec v1.33）: 隊長トークで選べることば。cookie `lang` に覚える（端末ごと。登録の情報には入れない）。
// 日本語が既定。ほかの4つは、札幌で暮らす外国人住民・技能実習生・留学生に多いことばから（11/7 本人の指示「多言語化」）。
export const LANGS = ["ja", "en", "zh", "ko", "vi"] as const;
export type Lang = (typeof LANGS)[number];

export const LANG_COOKIE = "lang";
export const DEFAULT_LANG: Lang = "ja";

export interface LangInfo {
  /** その言語での呼び方（切りかえのボタンに出す） */
  native: string;
  /** Claude に伝えるときの名前（英語） */
  name: string;
  /** ブラウザの読み上げ・音声認識に渡す印（BCP 47） */
  speech: string;
}

export const LANG_INFO: Record<Lang, LangInfo> = {
  ja: { native: "日本語", name: "Japanese", speech: "ja-JP" },
  en: { native: "English", name: "English", speech: "en-US" },
  zh: { native: "中文", name: "Simplified Chinese", speech: "zh-CN" },
  ko: { native: "한국어", name: "Korean", speech: "ko-KR" },
  vi: { native: "Tiếng Việt", name: "Vietnamese", speech: "vi-VN" },
};

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (LANGS as readonly string[]).includes(v);
}

/** cookie の値からことばへ。知らない値・空は日本語 */
export function parseLang(v: string | undefined | null): Lang {
  return isLang(v) ? v : DEFAULT_LANG;
}
