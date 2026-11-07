import { describe, expect, it } from "vitest";
import { viewCells } from "./cells";
import { TOWN_ROSTER as R } from "./morning/roster";
import { DEMO_MORNING } from "./morning/sample";
import { viewBases } from "./morning/view";
import { cellEmoji, emojiGrid, gridLines, mixedCount } from "./share";

const cells = () => viewCells([...viewBases(DEMO_MORNING).values()], R);

describe("絵文字グリッド（spec v1.1）", () => {
  it("完了はチーム色、人手不足は赤、返事なしは黒、まだは白", () => {
    const c = cells();
    const by = (n: number) => c.find((x) => x.baseNumbers.includes(n))!;
    expect(cellEmoji(by(1))).toBe("🟦"); // サルビアが完了
    expect(cellEmoji(by(2))).toBe("🟧"); // マリーゴールドが先に来て完了（ルピナスと混成）
    expect(cellEmoji(by(3))).toBe("🟥");
    expect(cellEmoji(by(6))).toBe("⬛");
    expect(cellEmoji(by(4))).toBe("⬜");
  });

  it("先頭にエリア名と日付と雪、最後に軒数とタグ。氏名は入らない", () => {
    const text = emojiGrid(cells(), DEMO_MORNING);
    const lines = text.split("\n");
    expect(lines[0]).toBe("シマエナGO しらかばエリア 12/14 雪12cm『もっちり大福』");
    expect(lines.at(-1)).toBe("#シマエナGO");
    expect(lines.at(-2)).toBe("3/7軒 あと4軒 ・ 混成1");
    const squares = lines.slice(1, -2).join("");
    expect([...squares].length).toBeGreaterThanOrEqual(cells().length);
    for (const p of R.participants) expect(text).not.toContain(p.nickname);
    expect(gridLines(cells()).length).toBeGreaterThanOrEqual(1);
    expect(mixedCount(DEMO_MORNING)).toBe(1);
  });

  it("全軒完了なら討伐と時刻", () => {
    const s = structuredClone(DEMO_MORNING);
    for (const m of s.missions) if (m.status !== "no_answer") m.status = "done";
    const text = emojiGrid(viewCells([...viewBases(s).values()], R), s);
    expect(text.split("\n").at(-2)).toMatch(/^7\/7軒 07:05 討伐/);
  });
});
