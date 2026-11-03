// Bot の文面（v1.4）: 1つの吹き出しに1つの話題、ボタンは最後、5つまで、仕事がないときも安心できる言い方
import { describe, expect, it } from "vitest";
import { fitFive, MSG, splitSentences, text } from "./messages";
import type { LineMessage, TextMessage } from "./types";

const texts = (ms: LineMessage[]) => ms.map((m) => (m as TextMessage).text);

describe("Bot の吹き出し", () => {
  it("点呼は あいさつ → 雪の量 → 質問 の3つ。時間は 5・15・30・60分と「今朝は休む」", () => {
    const ms = MSG.rollcallHelper(12);
    expect(texts(ms)).toEqual(["おはようございます！☃️", "今朝は雪12cm。", "今朝、何分動けますか？"]);
    const last = ms.at(-1) as TextMessage;
    expect(last.quickReply?.items.map((i) => i.action.label)).toEqual(["5分", "15分", "30分", "60分", "今朝は休む"]);
    expect(ms.slice(0, -1).every((m) => !(m as TextMessage).quickReply)).toBe(true);
  });

  it("出動する: 何分？は 5・15・30・60分", () => {
    const last = MSG.nowAsk().at(-1) as TextMessage;
    expect(last.quickReply?.items.map((i) => (i.action as { data?: string }).data)).toEqual(["now:5", "now:15", "now:30", "now:60"]);
  });

  it("仕事がないときは、お礼と次の案内（ひとりで5分・町の地図）", () => {
    const ms = MSG.nowNothing();
    expect(texts(ms)[0]).toBe("今近くに仕事がありません。");
    expect(texts(ms).join("")).toContain("ありがとう");
    const labels = (ms.at(-1) as TextMessage).quickReply?.items.map((i) => i.action.label);
    expect(labels).toContain("ひとりで5分を見る");
    expect(labels).toContain("町の地図を開く");
  });

  it("完了の返事は5つまでで、写真を撮るボタンや活動カードへのボタンが最後に付く", () => {
    const ms = MSG.doneReport({ baseNumber: 3, comment: "きれいです", notes: ["雪質: 湿り雪。"], team: { name: "サルビア", points: 20 }, grid: "🟦⬜" });
    expect(ms.length).toBeLessThanOrEqual(5);
    expect(texts(ms)[0]).toContain("あなたの5分で、1軒が助かりました");
    expect((ms.at(-1) as TextMessage).quickReply?.items.map((i) => i.action.label)).toContain("活動カードを見る");
    const go = MSG.goConfirmed(3, "https://maps.example/route").at(-1) as TextMessage;
    expect(go.quickReply?.items.map((i) => i.action.type)).toEqual(["camera", "cameraRoll", "uri", "uri"]);
  });

  it("5つを超えたら、ボタンのない吹き出しをつないで5つに収める（ボタンは残る）", () => {
    const many = [...["a", "b", "c", "d", "e", "f"].map(text), ...MSG.nowAsk()];
    const fit = fitFive(many);
    expect(fit).toHaveLength(5);
    expect((fit.at(-1) as TextMessage).quickReply).toBeDefined();
    expect(texts(fit).join("\n")).toContain("a");
  });

  it("長い予告は文ごとに分ける", () => {
    const ms = splitSentences("エナガ隊長です。明朝 6:30 に点呼します。予想 12cm。長靴と手袋を。", 3);
    expect(texts(ms)).toEqual(["エナガ隊長です。", "明朝 6:30 に点呼します。", "予想 12cm。長靴と手袋を。"]);
  });

  it("お願いする側が「出動する」を押しても、責めずに案内する", () => {
    expect(texts(MSG.nowForRequester()).join("")).toContain("点呼に答えるだけで大丈夫");
  });
});
