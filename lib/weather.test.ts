import { describe, expect, it } from "vitest";
import { addDays, clockText, jstDate, jstHourMinute, jstIso, jstMinutes } from "./jst";
import { forecastSnowUntilMorning, sumSnowfall } from "./weather";

describe("日本時間", () => {
  const d = new Date("2026-12-13T12:00:00Z"); // JST 21:00
  it("UTC の日時を JST の日付・分・時刻にする", () => {
    expect(jstDate(d)).toBe("2026-12-13");
    expect(jstMinutes(d)).toBe(21 * 60);
    expect(jstHourMinute(d)).toBe("2026-12-13T21:00");
    expect(jstDate(new Date("2026-12-13T16:30:00Z"))).toBe("2026-12-14"); // JST 1:30
  });
  it("日付の足し算と ISO", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(clockText(6 * 60 + 5)).toBe("06:05");
    expect(jstIso("2026-12-14", 7 * 60)).toBe("2026-12-14T07:00:00+09:00");
  });
});

describe("降雪の予報", () => {
  const hourly = {
    time: ["2026-12-13T20:00", "2026-12-13T21:00", "2026-12-13T22:00", "2026-12-14T05:00", "2026-12-14T06:00", "2026-12-14T07:00"],
    snowfall: [1, 2, 3, 4.5, 100, 100],
  };
  it("いまから翌朝 6:00 までを足す（6:00 以降は入れない）", () => {
    expect(sumSnowfall(hourly, "2026-12-13T21:00", "2026-12-14T06:00")).toBe(9.5);
  });
  it("Open-Meteo の答えから、対象の朝と降雪量を出す", async () => {
    const fetchFn = (async () => new Response(JSON.stringify({ hourly }))) as unknown as typeof fetch;
    const f = await forecastSnowUntilMorning([43.04, 141.37], new Date("2026-12-13T12:00:00Z"), fetchFn);
    expect(f).toEqual({ snowfallCm: 9.5, from: "2026-12-13T21:00", until: "2026-12-14T06:00", morningDate: "2026-12-14" });
  });
  it("朝 6 時前に呼ばれたら今朝が対象", async () => {
    const fetchFn = (async () => new Response(JSON.stringify({ hourly }))) as unknown as typeof fetch;
    const f = await forecastSnowUntilMorning([43.04, 141.37], new Date("2026-12-13T20:00:00Z"), fetchFn); // JST 5:00
    expect(f.morningDate).toBe("2026-12-14");
    expect(f.snowfallCm).toBe(4.5);
  });
  it("Open-Meteo が失敗したら例外", async () => {
    const fetchFn = (async () => new Response("", { status: 500 })) as unknown as typeof fetch;
    await expect(forecastSnowUntilMorning([43.04, 141.37], new Date(), fetchFn)).rejects.toThrow("500");
  });
});
