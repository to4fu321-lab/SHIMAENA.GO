import { describe, expect, it } from "vitest";
import { DEFAULT_FAB_POS, FAB_SIZE, inwardPx, parseFabPos, snapFab } from "./ChatFab";

describe("いつでも隊長トークのボタン（v1.43・v1.44）", () => {
  it("内側へ引っぱった長さ: 右の端なら左へ、左の端なら右へ動かすと正", () => {
    expect(inwardPx("right", -40)).toBe(40);
    expect(inwardPx("right", 40)).toBe(-40);
    expect(inwardPx("left", 40)).toBe(40);
  });

  it("覚えた場所を読む。壊れていれば右下", () => {
    expect(parseFabPos(null)).toEqual(DEFAULT_FAB_POS);
    expect(parseFabPos("こわれた")).toEqual(DEFAULT_FAB_POS);
    expect(parseFabPos(JSON.stringify({ side: "up", y: 0.5 }))).toEqual(DEFAULT_FAB_POS);
    expect(parseFabPos(JSON.stringify({ side: "left", y: 2 }))).toEqual(DEFAULT_FAB_POS);
    expect(parseFabPos(JSON.stringify({ side: "left", y: 0.3 }))).toEqual({ side: "left", y: 0.3 });
  });

  it("離した場所から近いほうの端に寄せる。上下は見出しと下のタブを隠さない範囲に", () => {
    expect(snapFab(20, 400, 390, 844).side).toBe("left");
    expect(snapFab(390 - FAB_SIZE, 400, 390, 844).side).toBe("right");
    expect(snapFab(100, 422, 390, 844).y).toBeCloseTo(0.5);
    expect(snapFab(100, 0, 390, 844).y).toBe(0.08);
    expect(snapFab(100, 844, 390, 844).y).toBe(0.82);
  });
});
