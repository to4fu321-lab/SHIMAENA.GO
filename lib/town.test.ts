import { describe, expect, it } from "vitest";
import { TOWN, getBuilding } from "./town";

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

  it("拠点の建物がすべて存在し、拠点どうしは 50m 以上離れている", () => {
    const centers = TOWN.bases.map((b) => {
      const building = getBuilding(b.buildingId);
      expect(building, b.id).toBeDefined();
      const poly = building!.polygon;
      return [poly.reduce((s, p) => s + p[0], 0) / poly.length, poly.reduce((s, p) => s + p[1], 0) / poly.length] as [number, number];
    });
    for (let i = 0; i < centers.length; i++)
      for (let j = i + 1; j < centers.length; j++) expect(dist(centers[i], centers[j])).toBeGreaterThan(50);
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
