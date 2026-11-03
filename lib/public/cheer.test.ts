import { beforeEach, describe, expect, it } from "vitest";
import { DEMO_DATE } from "../morning/flow";
import { announce } from "../morning/ops";
import { loadMorning } from "../morning/store";
import { teamTotals } from "../morning/view";
import { memoryRepo } from "../repo";
import { cheeredToday, cheerPct, CHEER_GOAL } from "./cheer";

describe("町を応援する", () => {
  beforeEach(() => {
    for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive"]) delete (globalThis as Record<string, unknown>)[k];
  });

  it("日付ごとに数え、得点には入らない", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    const before = teamTotals((await loadMorning()).morning);
    expect(await memoryRepo.getCheer(DEMO_DATE)).toBe(0);
    expect(await memoryRepo.incrementCheer(DEMO_DATE)).toBe(1);
    expect(await memoryRepo.incrementCheer(DEMO_DATE)).toBe(2);
    expect(await memoryRepo.getCheer("2026-12-15")).toBe(0);
    expect(teamTotals((await loadMorning()).morning)).toEqual(before);
    expect(await memoryRepo.listSoloLogsBetween("2026-01-01", "2026-12-31")).toEqual([]); // 羽にも入らない
  });

  it("1日1回（cookie の日付）とゲージ", () => {
    expect(cheeredToday(DEMO_DATE, DEMO_DATE)).toBe(true);
    expect(cheeredToday("2026-12-13", DEMO_DATE)).toBe(false);
    expect(cheeredToday(undefined, DEMO_DATE)).toBe(false);
    expect(cheerPct(0)).toBe(0);
    expect(cheerPct(CHEER_GOAL * 2)).toBe(100);
  });
});
