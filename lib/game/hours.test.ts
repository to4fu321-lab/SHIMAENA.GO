import { describe, expect, it } from "vitest";
import { isDokayuki, isMorningDone, isWorkHours } from "./hours";

const at = (hhmm: string) => new Date(`2026-12-14T${hhmm}:00+09:00`);

describe("雪かきの時間（v1.8）", () => {
  it("6:00〜19:00 ならいつでも。19時以降と早朝はだめ", () => {
    expect(isWorkHours(at("05:59"))).toBe(false);
    expect(isWorkHours(at("06:00"))).toBe(true);
    expect(isWorkHours(at("12:00"))).toBe(true);
    expect(isWorkHours(at("18:59"))).toBe(true);
    expect(isWorkHours(at("19:00"))).toBe(false);
    expect(isWorkHours(at("23:00"))).toBe(false);
  });
  it("朝ボーナスは 9:00 まで、ドカ雪は 15cm から", () => {
    expect(isMorningDone("2026-12-14T08:59:00+09:00")).toBe(true);
    expect(isMorningDone("2026-12-14T12:00:00+09:00")).toBe(false);
    expect(isDokayuki(15)).toBe(true);
    expect(isDokayuki(12)).toBe(false);
    expect(isDokayuki(undefined)).toBe(false);
  });
});
