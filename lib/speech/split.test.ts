import { describe, expect, it } from "vitest";
import { FIRST_PART_MAX, splitForVoice, VOICE_TOTAL_MAX } from "./split";

describe("隊長の声を2つに分ける", () => {
  it("短い文は1つのまま", () => {
    expect(splitForVoice("読み上げをオンにしました。")).toEqual(["読み上げをオンにしました。"]);
    expect(splitForVoice("   ")).toEqual([]);
  });
  it("長い返事は、最初の短い一文と残りに分ける（改行も文の切れ目）", () => {
    const parts = splitForVoice("こんばんはだしま〜！\nいまは19時で夜なので、よその家の雪かきは明日の6時からです。自分の家の前なら今からでも大丈夫えな。道の報告も見られるしま。");
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe("こんばんはだしま〜！");
    expect(parts[1].startsWith("いまは19時で夜なので")).toBe(true);
  });
  it("最初の部分は12字に届くまで文をまとめる（40字まで）。長すぎる文は1文のまま。全体は上限まで", () => {
    const [first, rest] = splitForVoice("はい。行きます。拠点3へ向かってください。とても長い文がここから続きます。");
    expect(first).toBe("はい。行きます。拠点3へ向かってください。");
    expect(rest).toBe("とても長い文がここから続きます。");
    expect(first.length).toBeLessThanOrEqual(FIRST_PART_MAX);
    expect(splitForVoice("あ".repeat(100))).toEqual(["あ".repeat(100)]);
    expect(splitForVoice("い。".repeat(200)).join("").length).toBeLessThanOrEqual(VOICE_TOTAL_MAX);
  });
});
