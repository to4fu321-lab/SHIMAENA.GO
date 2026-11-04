import { describe, expect, it } from "vitest";
import { countHomeNow, endHome, isHomeNow, startHome } from "./home-now";

const t = (hm: string) => new Date(`2026-12-14T${hm}:00+09:00`);

describe("いま自宅で雪かき中", () => {
  it("始めると数え、クリアで抜ける。同じ人は1人", () => {
    const rec: { homeNow?: Record<string, string> } = {};
    startHome(rec, "a", t("20:00"));
    startHome(rec, "b", t("20:05"));
    startHome(rec, "a", t("20:06"));
    expect(countHomeNow(rec, t("20:10"))).toBe(2);
    expect(endHome(rec, "a")).toBe(true);
    expect(countHomeNow(rec, t("20:10"))).toBe(1);
    expect(isHomeNow(rec, "b", t("20:10"))).toBe(true);
  });
  it("40分たったら数えない（押したまま忘れても）", () => {
    const rec: { homeNow?: Record<string, string> } = {};
    startHome(rec, "a", t("20:00"));
    expect(countHomeNow(rec, t("20:39"))).toBe(1);
    expect(countHomeNow(rec, t("20:40"))).toBe(0);
    startHome(rec, "b", t("20:45"));
    expect(Object.keys(rec.homeNow ?? {})).toEqual(["b"]);
  });
});
