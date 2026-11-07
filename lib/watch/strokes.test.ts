import { describe, expect, it } from "vitest";
import { cleanStrokes, createGravityFilter, createStrokeDetector, pacePerMinute, restHint } from "./strokes";

/** 雪かき 1 回ぶんの山（しきい値を超えて、戻る） */
function dig(d: ReturnType<typeof createStrokeDetector>, t: number, peak = 12): number {
  let n = 0;
  for (const m of [1, 4, peak, 6, 2, 1]) if (d.feed(t, m, 0, 0)) n++;
  return n;
}

describe("スコップカウンター", () => {
  it("山を 1 回ずつ数える（しきい値を超えて、戻ってから次）", () => {
    const d = createStrokeDetector();
    expect(dig(d, 0)).toBe(1);
    expect(dig(d, 1000)).toBe(1);
    expect(dig(d, 2000)).toBe(1);
    expect(d.count).toBe(3);
    expect(d.times.length).toBe(3);
  });
  it("しきい値を超えたまま揺れても 2 回にしない", () => {
    const d = createStrokeDetector();
    d.feed(0, 12, 0, 0);
    d.feed(50, 11, 0, 0);
    d.feed(100, 13, 0, 0);
    expect(d.count).toBe(1);
  });
  it("直前の 420ms 以内は数えない（1 つの動きのブレ）", () => {
    const d = createStrokeDetector();
    expect(dig(d, 0)).toBe(1);
    expect(dig(d, 200)).toBe(0);
    expect(dig(d, 600)).toBe(1);
  });
  it("歩く程度の揺れ（3〜5 m/s²）は数えない", () => {
    const d = createStrokeDetector();
    for (let t = 0; t < 10_000; t += 100) d.feed(t, 3 + (t % 300) / 150, 1, 0);
    expect(d.count).toBe(0);
  });
  it("途中から数え直せる・はじめの値を渡せる", () => {
    const d = createStrokeDetector({}, 10);
    dig(d, 0);
    expect(d.count).toBe(11);
    d.reset();
    expect(d.count).toBe(0);
  });
  it("1 分あたりの目安（直近 1 分の回数）", () => {
    expect(pacePerMinute([59_000, 58_000, 30_000, 1000], 60_000)).toBe(4);
    expect(pacePerMinute([1000], 60_000)).toBe(0);
    expect(pacePerMinute([100_000], 60_000)).toBe(0); // 未来の時刻は数えない
  });
  it("重力つきの加速度から重力を引く", () => {
    const f = createGravityFilter();
    let v: [number, number, number] = [0, 0, 0];
    for (let i = 0; i < 50; i++) v = f(0, 0, 9.8);
    expect(Math.abs(v[2])).toBeLessThan(0.5);
    const [, , z] = f(0, 0, 20);
    expect(z).toBeGreaterThan(5);
  });
  it("50 回ごとにひと息（体調の判断はしない）", () => {
    expect(restHint(49)).toBeUndefined();
    expect(restHint(50)).toContain("腰");
    expect(restHint(100)).toContain("100回");
  });
  it("記録に残す回数は 0〜9999 の整数", () => {
    expect(cleanStrokes("128")).toBe(128);
    expect(cleanStrokes("0")).toBeUndefined();
    expect(cleanStrokes("abc")).toBeUndefined();
    expect(cleanStrokes(12.7)).toBe(12);
    expect(cleanStrokes(99999)).toBe(9999);
  });
});
