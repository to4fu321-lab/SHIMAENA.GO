import { describe, expect, it } from "vitest";
import { estimateSnowKg, mockCardText } from "./card";
import { CARE_MAX, mockPhotoCheck, PhotoCheckSchema, SNOW_DENSITY, SNOW_TYPE_LABEL, trimCare } from "./photo";

describe("雪質と労い（spec v1.2 9-3）", () => {
  it("モックは採点表の形（雪質・労い入り）で、労いは30字まで", () => {
    const m = mockPhotoCheck();
    expect(PhotoCheckSchema.parse(m)).toEqual(m);
    expect(m.snowType).toBe("unknown");
    expect(m.care!.length).toBeLessThanOrEqual(CARE_MAX);
    expect(m.care).not.toMatch(/体調|病|医/);
    expect(trimCare(" とても  長い\n労い".repeat(10))).toHaveLength(CARE_MAX);
    for (const k of Object.keys(SNOW_DENSITY)) expect(SNOW_TYPE_LABEL[k as keyof typeof SNOW_TYPE_LABEL]).toBeTruthy();
  });

  it("排雪 kg は雪質の密度で変わる（粉雪 < ふつう < 湿り雪 < 凍結）", () => {
    const kg = (t: Parameters<typeof estimateSnowKg>[2]) => estimateSnowKg(12, "road", t);
    expect(kg("powder")).toBeLessThan(kg("unknown"));
    expect(kg("unknown")).toBeLessThan(kg("wet"));
    expect(kg("wet")).toBeLessThan(kg("icy"));
    expect(estimateSnowKg(12, "road")).toBe(kg("unknown")); // 雪質がなければふつう
    const base = { date: "2026-12-14", completedAtJst: "07:20", forecastCm: 12, level: 2 as const, clearArea: "road" as const, memberCount: 2, teamNames: ["サルビア"], style: "kawaii" as const, rarityLabel: "朝の群れ" };
    expect(mockCardText({ ...base, snowType: "wet" }).snowKg).toBeGreaterThan(mockCardText({ ...base, snowType: "powder" }).snowKg);
  });
});
