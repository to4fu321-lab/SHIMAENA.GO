// Bot の文面（v1.4）: 1つの吹き出しに1つの話題、ボタンは最後、5つまで、仕事がないときも安心できる言い方
import { describe, expect, it } from "vitest";
import { actionsOf, textOf } from "./flex";
import { heroParams, renderHeroSvg, renderSnowSvg, snowLevel, snowParams } from "./hero";
import { fitFive, MSG, splitSentences, text } from "./messages";
import type { FlexMessage, LineMessage } from "./types";

const texts = (ms: LineMessage[]) => ms.map(textOf);
const labels = (m: LineMessage) => actionsOf(m).map((a) => a.label);

describe("Bot の吹き出し", () => {
  it("点呼は 隊長カード（おはよう・今朝の雪）→ 質問 の2つ。時間は 10・20・30・60分と「今朝は休む」", () => {
    const ms = MSG.rollcallHelper(12, "ぼた雪のドンブリ");
    expect(texts(ms)).toEqual(["おはようだしま〜！☃️今朝は雪12cm、相手は『ぼた雪のドンブリ』です。", "今朝、何分動けますか？"]);
    const hero = (ms[0] as FlexMessage).contents.hero?.url as string;
    expect(hero).toContain("/api/line/hero/snow.png?cm=12&w=morning&s=");
    expect(ms.at(-1)?.type).toBe("flex"); // 答えは吹き出しの中の大きなボタン
    expect(labels(ms.at(-1)!)).toEqual(["10分", "20分", "30分", "60分", "今朝は休む"]);
    expect(ms.slice(0, -1).every((m) => actionsOf(m).length === 0)).toBe(true);
  });

  it("出動する: 何分？は 10・20・30・60分", () => {
    expect(actionsOf(MSG.nowAsk().at(-1)!).map((a) => (a as { data?: string }).data)).toEqual(["now:10", "now:20", "now:30", "now:60"]);
  });

  it("仕事がないときは、お礼と次の案内（ひとりで10分・町の地図）", () => {
    const ms = MSG.nowNothing();
    expect(texts(ms)[0]).toBe("今近くに仕事はありません。");
    expect(texts(ms).join("")).toContain("ありがとう");
    expect(labels(ms.at(-1)!)).toContain("ひとりで10分を見る");
    expect(labels(ms.at(-1)!)).toContain("町の地図を開く");
  });

  it("完了の返事は5つまでで、写真を撮るボタンや活動カードへのボタンが最後に付く", () => {
    const ms = MSG.doneReport({ baseNumber: 3, comment: "きれいです", notes: ["雪質: 湿り雪。"], team: { name: "サルビア", points: 20 }, grid: "🟦⬜" });
    expect(ms.length).toBeLessThanOrEqual(5);
    expect(texts(ms)[0]).toContain("あなたの10分で、1軒が助かりました");
    expect(labels(ms.at(-1)!)).toContain("活動カードを見る");
    const go = MSG.goConfirmed(3, "https://maps.example/route");
    expect(actionsOf(go.at(-1)!).map((a) => a.type)).toEqual(["camera", "cameraRoll"]);
  });

  it("5つを超えたら、ボタンのない吹き出しをつないで5つに収める（ボタンは残る）", () => {
    const many = [...["a", "b", "c", "d", "e", "f"].map(text), ...MSG.nowAsk()];
    const fit = fitFive(many);
    expect(fit).toHaveLength(5);
    expect(actionsOf(fit.at(-1)!).length).toBeGreaterThan(0);
    expect(texts(fit).join("\n")).toContain("a");
  });

  it("長い予告は文ごとに分ける", () => {
    const ms = splitSentences("エナガ隊長です。明朝 6:30 に点呼します。予想 12cm。長靴と手袋を。", 3);
    expect(texts(ms)).toEqual(["エナガ隊長です。", "明朝 6:30 に点呼します。", "予想 12cm。長靴と手袋を。"]);
  });

  it("お願いする側が「出動する」を押しても、責めずに案内する", () => {
    expect(texts(MSG.nowForRequester()).join("")).toContain("点呼に答えるだけで大丈夫");
  });

  it("行き先カード: 大きな画像（時刻と拠点だけ）・地図・ルートのボタン。画像を押すと道順", () => {
    const [ok, card, photo] = MSG.goConfirmed(3, "https://maps.example/route");
    expect(textOf(ok)).toContain("了解だしま〜");
    const c = card as FlexMessage;
    expect(c.altText).toBe("拠点3へ 7:00 に集合です！");
    expect(c.contents.hero?.url).toContain("/api/line/hero/go.png?t=7%3A00&n=3");
    expect((c.contents.hero?.action as { uri: string }).uri).toBe("https://maps.example/route");
    expect(labels(c)).toEqual(["地図で見る", "ルートを表示"]);
    expect(textOf(photo)).toContain("写真");
    // 道順がないときは地図だけ
    expect(labels(MSG.helpJoined(5)[1])).toEqual(["地図で見る"]);
  });

  it("「行く」「今朝は行けない」は大きなボタン。押した文字がトークに出る", () => {
    const [m] = MSG.planForHelper("拠点3へ 7:00 にお願いします。");
    const a = actionsOf(m);
    expect(a.map((x) => (x as { data?: string }).data)).toEqual(["go:yes", "go:no", undefined]);
    expect(a[0]).toMatchObject({ type: "postback", displayText: "👟 行く" });
  });

  it("行き先の画像: 変な値は既定に戻し、文字は画像に安全に入る", () => {
    expect(heroParams("<script>", "3; drop")).toEqual({ time: "7:00", base: "?" });
    expect(heroParams("now", "12")).toEqual({ time: "now", base: "12" });
    expect(snowParams("12", "<b>雪</b>のとても長い名前", "x")).toEqual({ cm: 12, name: "b雪/bのとても", when: "eve" });
    const svg = renderHeroSvg("7:00", "3");
    expect(svg).toContain("7:00");
    expect(svg).toContain("拠点 3");
  });

  it("隊長カード: 雪が多いほど★が増えて、ひとことが元気になる。予告はカード1枚", () => {
    expect([3, 12, 20, 35].map((cm) => snowLevel(cm).stars)).toEqual([1, 2, 3, 4]);
    expect(snowLevel(20).cheer).toContain("出番");
    const svg = renderSnowSvg(35, "大雪のドッシリ", "eve");
    expect(svg).toContain("明日の朝の相手");
    expect(svg).toContain("大雪のドッシリ");
    const [card] = MSG.announce("エナガ隊長だしま〜！明朝 6:30 に点呼するえな〜！予想は 12cm、相手は「ぼた雪のドンブリ」だしま〜！", 12, "ぼた雪のドンブリ");
    const lines = ((card as FlexMessage).contents.body?.contents as { text: string }[]).map((x) => x.text);
    expect(lines).toEqual(["エナガ隊長だしま〜！", "明朝 6:30 に点呼するえな〜！", "予想は 12cm、相手は「ぼた雪のドンブリ」だしま〜！"]);
  });

  it("お願いする側・見守りの文は、丁寧なまま（しま〜・えな〜を付けない）", () => {
    const plain = [...MSG.rollcallThanks("no"), ...MSG.familyNoAnswer(), ...MSG.knockThanks(), ...MSG.planForRequester("7:00", ["田中"])];
    expect(texts(plain).join("")).not.toMatch(/しま〜|えな〜/);
  });

  it("語尾「しま〜」「えな〜」は3文に1つくらい（多すぎない）", () => {
    const all = [
      ...MSG.rollcallHelper(12, "ぼた雪のドンブリ"), ...MSG.rollcallThanks("15"), ...MSG.goConfirmed(3, "https://x"),
      ...MSG.nowAsk(), ...MSG.nowNothing(), ...MSG.housesToday(3, true), ...MSG.goDeclined(),
    ];
    const lines = texts(all).join("\n").split(/(?<=[。！？!?])(?![！？!?〜])|\n/).map((x) => x.trim()).filter(Boolean);
    const voiced = lines.filter((l) => /しま〜|えな〜/.test(l)).length;
    expect(voiced / lines.length).toBeLessThanOrEqual(0.45);
    expect(voiced).toBeGreaterThan(0);
  });
});
