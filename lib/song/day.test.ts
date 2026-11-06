import { describe, expect, it } from "vitest";
import { loadSnowSong, songDateAllowed, songFacts, warmSnowSong } from "./day";

describe("今朝の雪の歌の保存（キーなし・メモリ）", () => {
  it("今朝の状態から材料を集め、1日1曲を残す（作り直しもできる）", async () => {
    const f = await songFacts("2026-12-14");
    expect(f.snowCm).toBe(12); // 見本の朝（予報 12cm）
    expect(f.snowName).toBe("もっちり大福");
    expect(await loadSnowSong("2026-12-14")).toBeUndefined();
    const a = await warmSnowSong("2026-12-14");
    expect(a.by).toBe("program");
    expect(a.explain).toContain("12cm");
    expect(await loadSnowSong("2026-12-14")).toEqual(a);
    expect(await warmSnowSong("2026-12-14", { force: true })).toEqual(a); // 同じ事実なら同じ曲
    const other = await warmSnowSong("2026-11-01");
    expect(other.explain).toContain("雪のない朝"); // 今朝の状態と日付がちがう日は雪なし
  });
});

describe("/api/song?date= で作ってよい日（お金の守り）", () => {
  it("今日と過去 7 日だけ。未来・8 日前・形のちがう日付は作らない", () => {
    expect(songDateAllowed("2026-12-14", "2026-12-14")).toBe(true);
    expect(songDateAllowed("2026-12-07", "2026-12-14")).toBe(true);
    expect(songDateAllowed("2026-12-06", "2026-12-14")).toBe(false);
    expect(songDateAllowed("2026-12-15", "2026-12-14")).toBe(false);
    expect(songDateAllowed("2026-12-1", "2026-12-14")).toBe(false);
    expect(songDateAllowed("2027-01-01", "2026-12-28")).toBe(false);
    expect(songDateAllowed("2026-12-25", "2027-01-01")).toBe(true); // 年をまたいでも 7 日以内
  });
});
