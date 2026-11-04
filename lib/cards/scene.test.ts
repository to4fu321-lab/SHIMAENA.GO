// その時だけの場面（spec v1.8）: 事実から決まる部分・Claude が選ぶ部分の点検・設計図の番号・消印の出し入れ・裏面の描き直し
import { describe, expect, it } from "vitest";
import { buildScene, mockCardText } from "../claude/card";
import { mockSceneChoice, sceneCode, sceneFacts, sceneLayer, tidySceneChoice } from "./scene";
import { backExtras, renderCardBackSvg, renderCardSvg, STAMP_START, withoutStamp, type CardArt } from "./svg";

const input = {
  date: "2026-12-14", completedAtJst: "06:52", forecastCm: 12, level: 2 as const, clearArea: "entrance" as const, memberCount: 3,
  teamNames: ["サルビア", "ルピナス"], style: "kawaii" as const, rarityLabel: "早朝の群れ", snowType: "wet" as const, seed: "rc-2026-12-14|m-base3",
};

describe("事実から決まる部分（AI は使わない）", () => {
  it("空は完了した時刻、降る雪は雪質と予報、積もり方は推定の深さ", () => {
    expect(sceneFacts({ completedHour: 6, snowType: "wet", forecastCm: 12, depthCm: 12 })).toEqual({ sky: "dawn", fall: "flakes", ground: 1 });
    expect(sceneFacts({ completedHour: 11, snowType: "powder", forecastCm: 6, depthCm: 3 })).toEqual({ sky: "day", fall: "powder", ground: 0 });
    expect(sceneFacts({ completedHour: 16, snowType: "icy", forecastCm: 8, depthCm: 20 })).toEqual({ sky: "dusk", fall: "none", ground: 2 });
    expect(sceneFacts({ completedHour: 18, snowType: "wet", forecastCm: 25, depthCm: 40 })).toEqual({ sky: "night", fall: "heavy", ground: 3 });
  });
});

describe("Claude が選ぶ部分の点検", () => {
  const fb = mockSceneChoice({ sky: "dawn", fall: "flakes", ground: 1 }, { thanks: true, members: 3, mixed: true });
  it("キーなしは事実から（ありがとうが届いたらお茶、3羽以上はにぎやか）", () => {
    expect(fb.props).toEqual(["sand", "tea"]);
    expect(fb.mood).toBe("lively");
    expect(fb.why).toContain("朝焼け");
  });
  it("候補の外の持ち物・知らない雰囲気・作った数字・名前の入った理由は使わない", () => {
    expect(tidySceneChoice({ props: ["sword", "tea", "tea", "sled"], mood: "angry", why: "6時52分に3羽で" }, fb, [6, 52, 3])).toEqual({ props: ["tea", "sled"], mood: "lively", why: "6時52分に3羽で" });
    expect(tidySceneChoice({ props: ["tea"], mood: "calm", why: "100人で" }, fb, [3]).why).toBe(fb.why);
    expect(tidySceneChoice({ props: ["tea", "sled"], mood: "calm", why: "佐藤さんの家" }, fb, []).why).toBe(fb.why);
    expect(tidySceneChoice({ props: ["tea"], mood: "calm", why: "静かな朝" }, fb, []).props).toEqual(fb.props); // 2つそろわなければ事実から
  });
});

describe("設計図の番号と絵", () => {
  it("同じ家・同じ時・同じ場面なら同じ番号。家が違えば違う番号（二度と同じものは出ない）", () => {
    const s = { sky: "dawn" as const, fall: "flakes" as const, ground: 1 as const, props: ["sand" as const, "tea" as const], mood: "lively" as const };
    expect(sceneCode("a|m1", s)).toBe(sceneCode("a|m1", s));
    expect(sceneCode("a|m1", s)).not.toBe(sceneCode("a|m2", s));
    expect(sceneCode("a|m1", s)).toMatch(/^[0-9a-f]{4}$/);
  });
  it("キーなしのカードにも場面が付き、表の絵に場面の層が入る（どのタッチでも）", () => {
    const t = mockCardText(input);
    expect(t.scene.sky).toBe("dawn");
    expect(buildScene(input).code).toBe(t.scene.code);
    for (const style of ["kawaii", "retrowave", "kirie", "pixel", "eijin"] as const) {
      const art: CardArt = { style, designName: t.designName, designNameEn: t.designNameEn, rarityLabel: "早朝", stars: 2, members: [{ name: "ゆき", teamId: "salvia" }], date: "2026-12-14", townName: "しらかば町内", snowKg: t.snowKg, snowKgComparison: t.snowKgComparison, serial: 1, issuedCount: 3, scene: t.scene };
      const svg = renderCardSvg(art);
      expect(svg).toContain(`data-scene="${t.scene.code}"`);
      expect(svg).toContain(STAMP_START);
      expect(withoutStamp(svg)).not.toContain("No.001/3"); // 演出用: 消印を外せる
    }
    expect(sceneLayer(t.scene)).toContain("clip-path");
  });
  it("裏面の描き直し（ありがとう点呼）でも、設計図と推定の元の行が残る", () => {
    const t = mockCardText(input);
    const art: CardArt = { style: "kawaii", designName: t.designName, designNameEn: t.designNameEn, rarityLabel: "早朝", stars: 2, members: [], date: "2026-12-14", townName: "しらかば町内", snowKg: t.snowKg, snowKgComparison: t.snowKgComparison, snowKgBasis: t.snowKgBasis, serial: 1, issuedCount: 3, scene: t.scene };
    const back = renderCardBackSvg(art, { thanks: "ありがとう", subtasks: [] });
    const ex = backExtras(back);
    expect(ex.scene).toEqual({ code: t.scene.code, why: t.scene.why });
    expect(ex.basis).toBe(t.snowKgBasis);
  });
});
