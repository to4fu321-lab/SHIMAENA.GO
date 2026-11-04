import { beforeEach, describe, expect, it } from "vitest";
import { announce } from "../morning/ops";
import { DEMO_DATE } from "../morning/flow";
import { cheerButtons, myCheerNews, sendHomeCheer } from "./cheer-ops";
import { completeSolo, startHomeNow } from "./ops";

describe("応援・おつかれさま（本番の操作）", () => {
  beforeEach(() => {
    for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive", "__shimaenaSoloScores"]) delete (globalThis as Record<string, unknown>)[k];
  });
  const now = new Date("2026-11-03T03:00:00Z"); // 日本時間 12:00

  it("自宅を始めた人に応援、終えた人におつかれさま。届いた人は次に開いたとき聞く", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await startHomeNow("h1", now);
    expect(await cheerButtons("h2", now)).toMatchObject({ working: 1, cheer: 1, finished: 0 });
    expect(await sendHomeCheer("h2", "cheer", now)).toBe(1);
    expect(await sendHomeCheer("h2", "cheer", now)).toBe(0); // 同じ相手へは1日1回

    const r = await completeSolo("h1", "own_house", { now });
    expect(r.ok).toBe(true);
    // 終えたら「雪かき中」から抜けて「終えた人」に
    expect(await cheerButtons("h2", now)).toMatchObject({ working: 0, finished: 1, thanks: 1 });
    expect(await sendHomeCheer("h3", "thanks", now)).toBe(1);
    expect(await cheerButtons("h1", now)).toMatchObject({ finished: 0 }); // 自分には送れない

    expect(await myCheerNews("h1", now)).toEqual({ newCheer: 1, newThanks: 1, total: 2 });
  });
});
