import { describe, expect, it } from "vitest";
import { QUESTIONS, fallbackQuestion, motifsOf, normalizeTurns, scrub, shouldDeliver, templateStory, tidyStory, type Turn } from "./core";
import { programMemory } from "./art";
import { cleanSvg } from "../cards/svg-clean";
import { nextTurn, writeStory } from "../claude/kikigaki";
import { renderCardBackSvg, backExtras, type CardArt } from "../cards/svg";

const t = (i: number, a: string): Turn => ({ q: QUESTIONS[i], a });

describe("雪の聞き書き（v1.26）の点検", () => {
  it("名前・住所・電話・メールを消し、体の話の文を落とす。家族のことばは残す", () => {
    const s = scrub("山田さんと遊んだ。北3条西5丁目 1-2 に住んでた。電話は 011-234-5678、yama@example.com。母さんとかまくらを作った。腰が痛くて病院に行った。");
    expect(s).not.toMatch(/山田|丁目|011|example|病院|痛/);
    expect(s).toContain("ご近所さん");
    expect(s).toContain("母さん");
    expect(s).toContain("かまくら");
  });

  it("画面から来たやりとりは、数と長さをそろえる", () => {
    const turns = normalizeTurns([{ q: "a", a: "x".repeat(999) }, { q: "", a: "y" }, "bad", ...Array.from({ length: 9 }, () => ({ q: "q", a: "a" }))]);
    expect(turns.length).toBeLessThanOrEqual(5);
    expect(turns[0].a.length).toBe(300);
    expect(normalizeTurns("x")).toEqual([]);
  });

  it("キーなしの質問は、まだ聞いていないものを順に。5つで終わり", () => {
    expect(fallbackQuestion([])).toBe(QUESTIONS[0]);
    expect(fallbackQuestion([t(0, "そり")])).toBe(QUESTIONS[1]);
    expect(fallbackQuestion(QUESTIONS.map((_, i) => t(i, "x")))).toBeUndefined();
  });

  it("キーなしのお話: 答えをつないで、題名は答えのことばから", () => {
    const turns = [t(0, "兄とそりで坂を滑った。"), t(1, ""), t(2, "降っているうちに少しずつ"), t(4, "ありがとう、うれしいよ")];
    const s = templateStory(turns);
    expect(s.title).toBe("坂道とそりの冬");
    expect(s.story).toContain("兄とそりで坂を滑った");
    expect(s.story).toContain("雪かきに来てくれる人へ。ありがとう、うれしいよ。");
    expect(s.story).not.toContain("雪かきは、"); // とばした質問は使わない
    expect(motifsOf([t(0, "かまくらで餅を焼いた")])).toEqual(["kamakura"]);
  });

  it("Claude の題名とお話にも同じ点検", () => {
    const s = tidyStory({ title: "「佐藤さんの冬の思い出がいっぱい」", story: "佐藤さんと雪かき。薬を飲んだ。楽しかった。" });
    expect(s.title).not.toMatch(/佐藤|「/);
    expect(s.story).not.toMatch(/佐藤|薬/);
    expect(s.title.length).toBeLessThanOrEqual(16);
  });

  it("届けるのは、本人が「届ける」を選び、その回にまだ届けていないときだけ", () => {
    expect(shouldDeliver(undefined, "m1")).toBe(false);
    expect(shouldDeliver({ share: false, delivered: [] }, "m1")).toBe(false);
    expect(shouldDeliver({ share: true, delivered: [] }, "m1")).toBe(true);
    expect(shouldDeliver({ share: true, delivered: ["m1"] }, "m1")).toBe(false);
  });

  it("キーなしでも質問とお話ができる", async () => {
    expect((await nextTurn([])).question).toBe(QUESTIONS[0]);
    const s = await writeStory([t(0, "雪だるまを作った"), t(4, "ありがとう")]);
    expect(s.by).toBe("program");
    expect(s.title).toBe("雪だるまの朝");
  });

  it("プログラムの絵は、答えのことばと印で毎回ちがい、点検も通る形", () => {
    const a = programMemory("kg-a", ["kamakura"]);
    expect(a).not.toBe(programMemory("kg-b", ["kamakura"]));
    expect(cleanSvg(a, "x")).toBeDefined();
  });

  it("カードの裏に1行。ありがとうで描き直しても残る", () => {
    const art: CardArt = { style: "kawaii", designName: "t", designNameEn: "t", rarityLabel: "朝の群れ", stars: 1, members: [{ name: "a" }], date: "2026-12-14", townName: "町", snowKg: 1, snowKgComparison: "x", serial: 1, issuedCount: 1 };
    const back = renderCardBackSvg(art, { thanks: "ありがとう", subtasks: ["a", "b", "c", "d", "e", "f"], firstFlight: false, story: "坂道とそりの冬" });
    expect(back).toContain("この家の雪の思い出「坂道とそりの冬」が届いています");
    expect(back.match(/☑/g)?.length).toBe(4);
    expect(backExtras(back).story).toBe("坂道とそりの冬");
  });
});

describe("届ける（v1.26）", () => {
  it("その家が終わったら、来た人の隊長トークに1回だけ届く", async () => {
    const { seedDemoStory, storyForMission, deliverStory } = await import("./ops");
    const { listThread } = await import("../inbox/store");
    await seedDemoStory("r-story");
    const s = await storyForMission("r-story", "m-x");
    expect(s?.title).toBe("坂道とそりの冬");
    expect(await deliverStory(s!, "m-x", ["demo:h1", "demo:h1", undefined, "demo:h2"])).toBe(2);
    const got = await listThread("demo:h1");
    expect(JSON.stringify(got.at(-1)?.body)).toContain("この家の雪の思い出が届きました");
    expect(await storyForMission("r-story", "m-x")).toBeUndefined(); // 二度目は届けない
    expect(await storyForMission("r-nobody", "m-x")).toBeUndefined();
  });
});
