// 雪の深さ・雪質・どけた雪の推定（spec v1.8）: 決めるのはプログラム。写真の読みは、自信と食い違いを確かめてから使う
import { describe, expect, it } from "vitest";
import { cardSnow, mockCardText } from "./claude/card";
import { tidyPhotoCheck } from "./claude/photo";
import { depthAt } from "./weather";
import { cleanPhotoDepth, consistentSnowType, estimateDepth, kgBasis, snowKgOf } from "./snow-estimate";

describe("深さの出どころを決める", () => {
  it("写真: 自信が中以上で、予報か積雪深と桁が合えば使う", () => {
    const d = estimateDepth({ forecastCm: 12, modelDepthCm: 40, photo: { min: 15, max: 25, confidence: "mid", ref: "玄関の段差" } });
    expect(d).toEqual({ cm: 20, source: "photo", label: "写真から約15〜25cm（玄関の段差と比べて）" });
  });
  it("写真の自信が低い・予報とかけ離れている（読み違い）ときは、予報の降雪量", () => {
    expect(estimateDepth({ forecastCm: 12, photo: { min: 15, max: 25, confidence: "low" } }).source).toBe("forecast");
    expect(estimateDepth({ forecastCm: 5, modelDepthCm: 8, photo: { min: 90, max: 110, confidence: "high" } })).toMatchObject({ source: "forecast", cm: 5 });
  });
  it("予報がなければ積雪深、どちらもなければ 5cm として（そう書く）", () => {
    expect(estimateDepth({ forecastCm: 0, modelDepthCm: 30 })).toMatchObject({ source: "model", cm: 30 });
    expect(estimateDepth({ forecastCm: 0 }).label).toContain("分からない");
  });
  it("写真の読みの点検: 範囲がおかしい・幅が広すぎる・0 は使わない", () => {
    expect(cleanPhotoDepth({ min: 0, max: 0, confidence: "high" })).toBeUndefined();
    expect(cleanPhotoDepth({ min: 30, max: 10, confidence: "high" })).toBeUndefined();
    expect(cleanPhotoDepth({ min: 5, max: 80, confidence: "high" })).toBeUndefined();
    expect(cleanPhotoDepth({ min: 10, max: 200, confidence: "high" })).toBeUndefined();
    expect(cleanPhotoDepth({ min: 10.4, max: 19.6, confidence: "mid" })).toEqual({ min: 10, max: 20, confidence: "mid" });
  });
});

describe("雪質と気温", () => {
  it("−6℃ 以下の湿り雪、+2℃ 以上の粉雪は、写真の読み違いとして「ふつうの雪」に戻す", () => {
    expect(consistentSnowType("wet", -8)).toBe("unknown");
    expect(consistentSnowType("wet", -1)).toBe("wet");
    expect(consistentSnowType("powder", 3)).toBe("unknown");
    expect(consistentSnowType("powder", -10)).toBe("powder");
    expect(consistentSnowType("icy", undefined)).toBe("icy");
  });
});

describe("どけた雪（kg）はプログラムが計算する", () => {
  it("面積 × 深さ × 密度。計算の元を1行で言える", () => {
    expect(snowKgOf(20, "entrance", "wet")).toBe(720); // 12m² × 0.2m × 300
    const d = estimateDepth({ forecastCm: 12, photo: { min: 15, max: 25, confidence: "high", ref: "長靴" } });
    expect(kgBasis(d, "entrance", "wet")).toBe("写真から約15〜25cm（長靴と比べて） × 玄関前 12m² × 重い湿り雪");
  });
  it("カード: 写真の深さがあればそれで、なければ予報で。キーなしの文字も同じ数字", () => {
    const base = { forecastCm: 12, clearArea: "entrance" as const, snowType: "wet" as const };
    expect(cardSnow(base).snowKg).toBe(snowKgOf(12, "entrance", "wet"));
    const withPhoto = cardSnow({ ...base, photoDepth: { min: 15, max: 25, confidence: "mid" } });
    expect(withPhoto.snowKg).toBe(720);
    expect(withPhoto.snowKgBasis).toContain("写真から");
    const m = mockCardText({ ...base, date: "2026-12-14", completedAtJst: "07:20", level: 2, memberCount: 2, teamNames: ["サルビア"], style: "kawaii", rarityLabel: "朝の群れ", photoDepth: { min: 15, max: 25, confidence: "mid" } });
    expect(m.snowKg).toBe(720);
  });
});

describe("写真から読む深さ（Claude の答えの点検）", () => {
  const raw = {
    cleared: true, passable: true, icy: false, uncertain: false, snowType: "wet" as const, care: "おつかれさま", comment: "通れます",
    evidence: "地面が見える", width: "one" as const, hazards: [], unrelated: false, snowTypeReason: "塊が光って水気がある",
    depthCmMin: 15, depthCmMax: 25, depthRef: "玄関の段差", depthConfidence: "mid" as const,
  };
  it("読めた深さと目印は残し、関係ない写真や雪質が分からないときは理由を出さない", () => {
    expect(tidyPhotoCheck(raw).depth).toEqual({ min: 15, max: 25, confidence: "mid", ref: "玄関の段差" });
    expect(tidyPhotoCheck(raw).snowTypeReason).toBe("塊が光って水気がある");
    expect(tidyPhotoCheck({ ...raw, unrelated: true }).depth).toBeUndefined();
    expect(tidyPhotoCheck({ ...raw, snowType: "unknown" }).snowTypeReason).toBeUndefined();
  });
});

describe("Open-Meteo の積雪深", () => {
  it("朝の時刻の値を cm で。なければ undefined", () => {
    const h = { time: ["2026-12-14T05:00", "2026-12-14T06:00"], snowfall: [1, 2], snow_depth: [0.31, 0.334] };
    expect(depthAt(h, "2026-12-14T06:00")).toBe(33);
    expect(depthAt({ ...h, snow_depth: undefined }, "2026-12-14T06:00")).toBeUndefined();
    expect(depthAt(h, "2026-12-14T07:00")).toBeUndefined();
  });
});
