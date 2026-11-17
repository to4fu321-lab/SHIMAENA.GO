// 人数が少ない間のチーム分け（spec v1.71）: 500m 以内は同じチーム、離れていれば別のチーム。
import { describe, expect, it } from "vitest";
import type { LatLng } from "../types";
import { nearGroups, SMALL_TOWN_MAX, teamForLocation, teamsByDistance } from "./near-team";

// 北へ m メートル動かした点（緯度 1度 ≒ 111km）
const north = (m: number): LatLng => [43.04 + m / 111_000, 141.37];
const at = (id: string, m: number, teamId?: "salvia" | "marigold" | "lupinus") => ({ id, location: north(m), ...(teamId ? { teamId } : {}) });

describe("近い人のかたまり", () => {
  it("500m 以内でつながる人は1つ（A–B、B–C が近ければ A・B・C）", () => {
    const g = nearGroups([at("a", 0), at("b", 400), at("c", 800), at("far", 3000)]);
    expect(g.map((x) => x.map((m) => m.id).sort())).toEqual([["a", "b", "c"], ["far"]]);
  });
});

describe("チームを組み直す（毎週）", () => {
  it("近い人はワンチーム、遠い人はそれぞれ別のチーム", () => {
    const t = teamsByDistance([at("a", 0, "salvia"), at("b", 300, "marigold"), at("c", 450, "lupinus"), at("x", 2000), at("y", 5000)]);
    expect(new Set([t.a, t.b, t.c]).size).toBe(1);
    expect(new Set([t.a, t.x, t.y]).size).toBe(3);
  });

  it("今の色をなるべく変えない（かたまりの中で多い色）", () => {
    const t = teamsByDistance([at("a", 0, "lupinus"), at("b", 100, "lupinus"), at("c", 200, "salvia")]);
    expect([t.a, t.b, t.c]).toEqual(["lupinus", "lupinus", "lupinus"]);
  });

  it("かたまりが4つ以上なら、色はくり返す（3チームのまま）", () => {
    const t = teamsByDistance([0, 2000, 4000, 6000].map((m, i) => at(`p${i}`, m)));
    expect(new Set(Object.values(t)).size).toBe(3);
  });
});

describe("新しく入る人のチーム", () => {
  it("人数が少ない間は、500m 以内のいちばん近い人と同じチーム", () => {
    const members = [at("a", 0, "salvia"), at("b", 3000, "marigold")];
    expect(teamForLocation(north(200), members)).toBe("salvia");
    expect(teamForLocation(north(2700), members)).toBe("marigold");
  });

  it("近い人がいなければ、人のいないチーム（別のチーム）", () => {
    expect(teamForLocation(north(1500), [at("a", 0, "salvia"), at("b", 3000, "marigold")])).toBe("lupinus");
  });

  it("人数が多くなったら、近さより人数のバランス（いちばん少ないチーム）", () => {
    const members = Array.from({ length: SMALL_TOWN_MAX }, (_, i) => at(`p${i}`, i * 10, i < 5 ? "salvia" : i < 7 ? "marigold" : "lupinus"));
    expect(teamForLocation(north(0), members)).toBe("lupinus");
  });
});
