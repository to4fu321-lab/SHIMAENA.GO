import { describe, expect, it } from "vitest";
import { CELL_M, cellCenter, cellKey, cellPolygon, viewCells } from "./cells";
import { distanceM } from "./game/help";
import type { BaseView } from "./morning/view";
import { TOWN_ROSTER } from "./morning/roster";
import { TOWN } from "./town";

const view = (baseId: string, status: BaseView["status"], teams: BaseView["teams"] = []): BaseView => ({
  baseId,
  status,
  teams,
  requiredPeople: 2,
  goingPeople: teams.length,
});

describe("50m マス", () => {
  it("マスは一辺 50m", () => {
    const poly = cellPolygon("0,0");
    expect(Math.round(distanceM(poly[0], poly[1]))).toBe(CELL_M);
    expect(Math.round(distanceM(poly[1], poly[2]))).toBe(CELL_M);
  });

  it("マスの中心はもう一度同じマスに入る", () => {
    for (const key of ["0,0", "3,-2", "-5,4"]) expect(cellKey(cellCenter(key))).toBe(key);
  });

  it("拠点のデータは実在の建物と結びついていない", () => {
    for (const b of TOWN.bases) expect(b).not.toHaveProperty("buildingId");
  });

  it("人手不足が1軒でもあれば、マスは人手不足として見える", () => {
    const [a, b] = TOWN.bases;
    const cells = viewCells([view(a.id, "done", ["salvia"]), view(b.id, "short")], TOWN_ROSTER);
    const byNumber = (n: number) => cells.find((c) => c.baseNumbers.includes(n))!;
    expect(byNumber(b.number).status).toBe("short");
  });

  it("マスの中が全部終わったら完了。2チームなら両方の色が残る", () => {
    const a = TOWN.bases[0];
    const cell = viewCells([view(a.id, "done", ["salvia", "lupinus"])], TOWN_ROSTER).find((c) => c.baseNumbers.includes(a.number))!;
    expect(cell.status).toBe("done");
    expect(cell.teams).toEqual(["salvia", "lupinus"]);
    expect(cell.doneRatio).toBe(1);
  });

  it("ミッションのない拠点だけのマスは none", () => {
    const cells = viewCells([], TOWN_ROSTER);
    expect(cells.every((c) => c.status === "none")).toBe(true);
    expect(cells.flatMap((c) => c.baseNumbers).sort((x, y) => x - y)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
