import { describe, expect, it } from "vitest";
import { parseSkyParam, skyColors, timeOfDay, weatherOf } from "./sky";

describe("ホームの空", () => {
  it("時間で朝・昼・夕方・夜", () => {
    expect(timeOfDay(6 * 60 + 30)).toBe("dawn");
    expect(timeOfDay(12 * 60)).toBe("day");
    expect(timeOfDay(17 * 60)).toBe("dusk");
    expect(timeOfDay(21 * 60)).toBe("night");
    expect(timeOfDay(3 * 60)).toBe("night");
  });
  it("天気コードで雪・くもり・晴れ。取れないときは今朝の予報", () => {
    expect(weatherOf(73)).toBe("snow");
    expect(weatherOf(86)).toBe("snow");
    expect(weatherOf(0)).toBe("clear");
    expect(weatherOf(3)).toBe("cloudy");
    expect(weatherOf(61)).toBe("cloudy");
    expect(weatherOf(undefined, 12)).toBe("snow");
    expect(weatherOf(undefined, 0)).toBe("cloudy");
  });
  it("デモ用の ?sky= は正しい形だけ受け付ける", () => {
    expect(parseSkyParam("night-snow")).toEqual({ time: "night", weather: "snow" });
    expect(parseSkyParam("noon-rain")).toBeUndefined();
    expect(parseSkyParam(undefined)).toBeUndefined();
  });
  it("12通りすべてに色がある", () => {
    for (const time of ["dawn", "day", "dusk", "night"] as const)
      for (const weather of ["snow", "cloudy", "clear"] as const) expect(skyColors({ time, weather })).toHaveLength(2);
  });
});
