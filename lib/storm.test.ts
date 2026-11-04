import { afterEach, describe, expect, it } from "vitest";
import { firstStormNotice, resetStormCache, setManualStop, stopWarnings, stormStatus } from "./storm";

const json = (warnings: { code: string; status: string }[], code = "0110000") => ({
  areaTypes: [{ areas: [{ code: "016010", warnings: [{ code: "02", status: "発表" }] }] }, { areas: [{ code, warnings }] }],
});
const fakeFetch = (body: unknown, ok = true) => (async () => ({ ok, status: ok ? 200 : 500, json: async () => body })) as unknown as typeof fetch;

afterEach(() => resetStormCache());

describe("警報の日のお休み", () => {
  it("札幌市の暴風雪警報・大雪警報で止める（注意報や解除では止めない）", () => {
    expect(stopWarnings(json([{ code: "02", status: "発表" }, { code: "06", status: "継続" }]))).toEqual(["暴風雪警報", "大雪警報"]);
    expect(stopWarnings(json([{ code: "13", status: "発表" }, { code: "12", status: "継続" }]))).toEqual([]);
    expect(stopWarnings(json([{ code: "02", status: "解除" }]))).toEqual([]);
    expect(stopWarnings(json([{ code: "32", status: "発表" }]))).toEqual(["暴風雪特別警報"]);
  });
  it("ほかの市区町村の警報では止めない", () => {
    expect(stopWarnings(json([{ code: "02", status: "発表" }], "0120300"))).toEqual([]);
  });
  it("気象庁の警報で止まる・手動でも止まる", async () => {
    expect((await stormStatus(fakeFetch(json([{ code: "02", status: "発表" }])))).stopped).toBe(true);
    resetStormCache();
    expect((await stormStatus(fakeFetch(json([])))).stopped).toBe(false);
    await setManualStop(true);
    expect(await stormStatus(fakeFetch(json([])))).toMatchObject({ stopped: true, source: "manual" });
  });
  it("気象庁が見られないときは止めない（前の結果もなし）", async () => {
    expect((await stormStatus(fakeFetch({}, false))).stopped).toBe(false);
  });
  it("お休みのお知らせは1日1回", async () => {
    expect(await firstStormNotice("2026-12-20")).toBe(true);
    expect(await firstStormNotice("2026-12-20")).toBe(false);
    expect(await firstStormNotice("2026-12-21")).toBe(true);
  });
});
