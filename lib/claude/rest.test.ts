import { describe, expect, it } from "vitest";
import { mockRestLine, restLine, restLineOk } from "./rest";

const base = { todayCount: 0, weather: "snow" as const, timeOfDay: "day" as const, tempC: -3, windMs: 2 };

describe("休みのひとこと", () => {
  it("定型は出動回数・寒さ・風で変わる", () => {
    expect(mockRestLine({ ...base, todayCount: 3 })).toContain("3回");
    expect(mockRestLine({ ...base, tempC: -8 })).toContain("温め");
    expect(mockRestLine({ ...base, windMs: 10 })).toContain("風");
    expect(restLineOk(mockRestLine({ ...base, todayCount: 3 }), { ...base, todayCount: 3 })).toBe(true);
  });
  it("体のことば・作った数字・長すぎる文は使わない", () => {
    expect(restLineOk("体調が悪ければ休んでね", base)).toBe(false);
    expect(restLineOk("あと5回がんばるしま〜", base)).toBe(false);
    expect(restLineOk("あ".repeat(40), base)).toBe(false);
  });
  it("キーがないときは定型", async () => {
    expect(await restLine("2026-12-14", base)).toBe(mockRestLine(base));
  });
});
