// 隊長トークの読み上げ（spec v1.18・v1.36）: 新しく届いた隊長の吹き出しだけを読む。純粋な関数なのでテストしやすい。
// 11/7 本人の指摘「チャットの1番最初に話した事を読み上げてくる」: 送った文の仮の吹き出し（tmp-…）が返事で消えると、
// 「どこまで読んだか」の印を見失って流れの最初から読んでいた → 印は「すでに見た隊長の吹き出しの id」で持つ。
import type { ChatBubble } from "../inbox/view";

/** 1回に読む吹き出しの数（まとめて届いたときは新しいほうから） */
export const SPEAK_MAX_BUBBLES = 3;

/** 吹き出しの読む文（「隊長が調べた」札＝絵文字の並びは読まない） */
export function speakText(b: ChatBubble): string {
  if (b.text !== undefined) return b.text;
  return (b.lines ?? [])
    .filter((l) => !l.steps)
    .map((l) => l.text)
    .join("。");
}

/**
 * まだ見ていない隊長の吹き出しを、読む文にする（なければ ""）。seen は呼ぶたびに今の吹き出しで埋め直す。
 * 初めて呼んだとき（開いた直後）は何も読まない
 */
export function freshCaptainText(bubbles: ChatBubble[], seen: Set<string> | undefined): { text: string; seen: Set<string> } {
  const now = new Set(bubbles.filter((b) => b.from === "captain").map((b) => b.id));
  if (!seen) return { text: "", seen: now };
  const fresh = bubbles.filter((b) => b.from === "captain" && !seen.has(b.id) && !b.id.startsWith("tmp-")).slice(-SPEAK_MAX_BUBBLES);
  const text = fresh
    .map(speakText)
    .filter((s) => s.trim())
    .join("。");
  return { text, seen: new Set([...seen, ...now]) };
}
