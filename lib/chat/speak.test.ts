import { describe, expect, it } from "vitest";
import type { ChatBubble } from "../inbox/view";
import { freshCaptainText, SPEAK_MAX_BUBBLES } from "./speak";

const cap = (id: string, text: string): ChatBubble => ({ id, from: "captain", at: "2026-12-01T00:00:00Z", text, buttons: [], quick: [] });
const me = (id: string, text: string): ChatBubble => ({ id, from: "me", at: "2026-12-01T00:00:00Z", text, buttons: [], quick: [] });

describe("読み上げ: 新しい隊長の吹き出しだけ", () => {
  it("開いた直後は読まない", () => {
    expect(freshCaptainText([cap("1", "はじめまして")], undefined).text).toBe("");
  });

  it("文を送って仮の吹き出しが返事で置きかわっても、最初の文は読まず、新しい返事だけを読む（11/7 本人の指摘）", () => {
    let r = freshCaptainText([cap("1", "最初のあいさつ"), me("2", "前に話したこと"), cap("3", "前の返事")], undefined);
    r = freshCaptainText([cap("1", "最初のあいさつ"), me("2", "前に話したこと"), cap("3", "前の返事"), me("tmp-9", "雪かきに出たい")], r.seen);
    expect(r.text).toBe("");
    r = freshCaptainText([cap("1", "最初のあいさつ"), me("2", "前に話したこと"), cap("3", "前の返事"), me("4", "雪かきに出たい"), cap("5", "いいえな！"), cap("6", "拠点3へ")], r.seen);
    expect(r.text).toBe("いいえな！。拠点3へ");
    expect(freshCaptainText([cap("1", "最初のあいさつ"), cap("5", "いいえな！"), cap("6", "拠点3へ")], r.seen).text).toBe("");
  });

  it("まとめて届いたときは新しいほうから数個。「隊長が調べた」札は読まない", () => {
    const many = Array.from({ length: 6 }, (_, i) => cap(`n${i}`, `知らせ${i}`));
    const r = freshCaptainText(many, new Set());
    expect(r.text.split("。")).toHaveLength(SPEAK_MAX_BUBBLES);
    expect(r.text.endsWith("知らせ5")).toBe(true);
    const card: ChatBubble = { ...cap("c", ""), text: undefined, lines: [{ text: "拠点3へ", strong: true }, { text: "隊長が調べたこと: 🗺 町", steps: ["🗺 町"] }] };
    expect(freshCaptainText([card], new Set()).text).toBe("拠点3へ");
  });
});
