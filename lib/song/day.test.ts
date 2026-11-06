import { describe, expect, it } from "vitest";
import { loadSnowSong, songFacts, warmSnowSong } from "./day";

describe("今朝の雪の歌の保存（キーなし・メモリ）", () => {
  it("今朝の状態から材料を集め、1日1曲を残す（作り直しもできる）", async () => {
    const f = await songFacts("2026-12-14");
    expect(f.snowCm).toBe(12); // 見本の朝（予報 12cm）
    expect(f.snowName).toBe("ぼた雪のドンブリ");
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
