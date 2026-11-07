// 隊長の声を2つに分ける（spec v1.36。11/7 本人の指摘「読み上げない」）: 長い返事は声ができるまで 10 秒以上かかり、
// 待ちきれずに無音になっていた → 最初の短い一文だけを先に作って鳴らし、残りはその間に作る。
// 鍵なしの VOICEVOX は回数の枠が小さいので、分けるのは2つまで。画面からもサーバーからも使える純粋な関数。

/** 最初に鳴らす部分: この長さ（字）に届くまで文をまとめる。短いほど早く鳴り始める */
export const FIRST_PART_MIN = 12;
/** 最初に鳴らす部分の上限（字）。1文でこれを超えるときは、その1文だけ */
export const FIRST_PART_MAX = 40;
/** 全体で読む長さの上限（字）。/api/voice の上限（200）より短く */
export const VOICE_TOTAL_MAX = 180;

/** 文を「最初の短い部分」と「残り」に分ける（残りがなければ1つ）。文の切れ目（。！？改行）で切る */
export function splitForVoice(text: string): string[] {
  const s = text
    .replace(/([。！？!?])\s*\n+\s*/g, "$1")
    .replace(/\s*\n+\s*/g, "。")
    .trim()
    .slice(0, VOICE_TOTAL_MAX);
  if (!s) return [];
  const sentences = s.match(/[^。！？!?]+[。！？!?]*/g) ?? [s];
  let first = "";
  let i = 0;
  while (i < sentences.length && (first === "" || (first.length < FIRST_PART_MIN && first.length + sentences[i].length <= FIRST_PART_MAX))) {
    first += sentences[i];
    i++;
  }
  const rest = sentences.slice(i).join("").trim();
  return [first.trim(), rest].filter(Boolean);
}
