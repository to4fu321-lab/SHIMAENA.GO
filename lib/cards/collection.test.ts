import { describe, expect, it } from "vitest";
import type { Card } from "../types";
import { collection, nextReward, REWARDS } from "./collection";

const card = (style: Card["style"], teamIds: Card["teamIds"] = ["salvia"]): Card => ({
  id: `c-${style}-${teamIds.join("")}`,
  recipientId: "h1",
  rollcallId: "rc",
  missionId: "m",
  serial: 1,
  issuedCount: 1,
  designName: "x",
  designNameEn: "x",
  rarityLabel: "x",
  stars: 1,
  style,
  snowKg: 100,
  snowKgComparison: "米袋",
  memberNames: ["a"],
  teamIds,
  createdAt: "2026-12-14T07:05:00+09:00",
});

describe("図鑑とご褒美（spec v1.2 7）", () => {
  it("カードがなければ全部未入手。1枚で初出撃とかわいいが埋まる", () => {
    const empty = collection([]);
    expect(empty.styles.every((s) => !s.got)).toBe(true);
    expect(empty.ribbons.every((r) => !r.got)).toBe(true);
    const one = collection([card("kawaii")]);
    expect(one.styles.find((s) => s.style === "kawaii")?.got).toBe(true);
    expect(one.ribbons.find((r) => r.key === "first")?.got).toBe(true);
    expect(one.ribbons.find((r) => r.key === "early")?.got).toBe(false);
  });

  it("混成はチームが2つのカード、早朝・大雪・連続はタッチで決まる", () => {
    const c = collection([card("retrowave"), card("eijin", ["salvia", "lupinus"]), card("kirie"), card("pixel")]);
    expect(c.ribbons.map((r) => r.got)).toEqual([true, true, true, true, true]);
    expect(c.styles.map((s) => s.got)).toEqual([false, true, true, true, true]);
    expect(c.total).toBe(4);
  });

  it("ご褒美は枚数で次の目標が決まり、最後まで行けば null", () => {
    expect(nextReward(0)).toMatchObject({ at: 10, left: 10 });
    expect(nextReward(10)).toMatchObject({ at: 20, left: 10 });
    expect(nextReward(99)).toBeNull();
    for (const r of REWARDS) expect(r.from).toContain("架空");
  });
});
