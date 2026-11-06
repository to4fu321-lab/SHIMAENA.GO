import { describe, expect, it } from "vitest";
import { crystal, programMotif, sanitizeMotif, stickerSvg, type MotifRaw } from "./motif";
import { calendarTopics } from "../topic/calendar";
import { safeTopic } from "../topic/day";

const shape = (o: Partial<MotifRaw["shapes"][number]>): MotifRaw["shapes"][number] => ({
  kind: "circle", x: 60, y: 60, r: 10, w: 0, h: 0, points: "", d: "", fill: "#ffffff", stroke: "none", strokeWidth: 0, opacity: 1, ...o,
});

describe("カードの挿絵（v1.23）", () => {
  it("Claude の図形を点検して SVG にする（危ないものは捨てる）", () => {
    const m = sanitizeMotif(
      {
        bg: "#dff1ff",
        shapes: [
          shape({}),
          shape({ kind: "rect", x: 10, y: 10, w: 30, h: 20, fill: "url(javascript:alert(1))" }),
          shape({ kind: "path", d: "M10 10 L50 50 Z" }),
          shape({ kind: "path", d: "M0 0\"/><script>alert(1)</script>" }),
          shape({ kind: "polygon", points: "10,10 20,30 30,10" }),
          shape({ kind: "circle", x: 9999, y: -9999, r: 5 }),
        ],
      },
      "冬至",
    )!;
    expect(m.by).toBe("claude");
    expect(m.body).not.toMatch(/script|javascript|url\(/);
    expect(m.body).toContain('fill="none"'); // 色でないものは塗らない
    expect(m.body).toContain('cx="140"'); // 範囲の外は端に寄せる
    expect(m.body.match(/<path/g)?.length).toBe(1);
  });

  it("図形が少なすぎたら使わない", () => {
    expect(sanitizeMotif({ bg: "#fff000", shapes: [shape({})] }, "x")).toBeUndefined();
  });

  it("プログラムの挿絵は番号ごとに毎回ちがう", () => {
    const a = programMotif("rc|m1|07:05", "大雪", "crystal").body;
    const b = programMotif("rc|m2|07:09", "大雪", "crystal").body;
    expect(a).not.toBe(b);
    expect(crystal("x", 0, 0, 10)).toContain("rotate(300)");
  });

  it("ステッカーに話題の名前を出す", () => {
    const svg = stickerSvg("kawaii", programMotif("s", "冬至", "yuzu"), "ab12");
    expect(svg).toContain("冬至");
    expect(svg).toContain('clip-path="url(#moab12)"');
  });
});

describe("今日の話題", () => {
  it("暦: 冬至・クリスマス・節分、ふだんの日も何か出る", () => {
    expect(calendarTopics("2026-12-22")[0].label).toBe("冬至");
    expect(calendarTopics("2026-12-25").map((t) => t.label)).toContain("クリスマス");
    expect(calendarTopics("2027-02-03")[0].label).toBe("節分");
    expect(calendarTopics("2027-01-28").length).toBeGreaterThan(0);
  });

  it("明るくない話題・名前・会社名ははじく", () => {
    expect(safeTopic({ label: "初雪の朝", hint: "白い屋根" })).toBe(true);
    expect(safeTopic({ label: "地震の備え", hint: "" })).toBe(false);
    expect(safeTopic({ label: "市長選挙", hint: "" })).toBe(false);
    expect(safeTopic({ label: "山田さん", hint: "" })).toBe(false);
    expect(safeTopic({ label: "SUPERMART", hint: "" })).toBe(false);
    expect(safeTopic({ label: "とても長い長い話題の名前です", hint: "" })).toBe(false);
  });
});
