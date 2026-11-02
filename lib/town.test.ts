import { describe, expect, it } from "vitest";
import { TOWN } from "./town";

const M_PER_LAT = 111320;
const M_PER_LNG = 111320 * Math.cos((TOWN.center[0] * Math.PI) / 180);
const dist = (a: [number, number], b: [number, number]) =>
  Math.hypot((a[0] - b[0]) * M_PER_LAT, (a[1] - b[1]) * M_PER_LNG);

describe("架空の町内データ", () => {
  it("拠点8・依頼者8・手伝う側12", () => {
    expect(TOWN.bases).toHaveLength(8);
    expect(TOWN.participants.filter((p) => p.role === "requester")).toHaveLength(8);
    expect(TOWN.participants.filter((p) => p.role === "helper")).toHaveLength(12);
  });

  it("手伝う側は3チームに4人ずつ", () => {
    const helpers = TOWN.participants.filter((p) => p.role === "helper");
    for (const team of ["salvia", "marigold", "lupinus"]) {
      expect(helpers.filter((h) => h.teamId === team)).toHaveLength(4);
    }
  });

  it("拠点はそれぞれ依頼者がいて、拠点どうしは 50m 以上離れている", () => {
    const points = TOWN.bases.map((b) => {
      const r = TOWN.participants.find((p) => p.id === b.requesterId);
      expect(r?.role, b.id).toBe("requester");
      return r!.location;
    });
    for (let i = 0; i < points.length; i++)
      for (let j = i + 1; j < points.length; j++) expect(dist(points[i], points[j])).toBeGreaterThanOrEqual(49);
  });

  it("依頼者にはレベル（1〜3）がある", () => {
    for (const r of TOWN.participants.filter((p) => p.role === "requester")) {
      expect([1, 2, 3]).toContain(r.level);
    }
  });

  it("出典表記がある", () => {
    expect(TOWN.attribution).toContain("OpenStreetMap");
  });
});
