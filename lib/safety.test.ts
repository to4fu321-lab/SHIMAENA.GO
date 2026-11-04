// 安全のひとこと（spec v1.6）: 出すかどうかは天気の数字だけ。いつも「ひとりでやらない」「休む」が入る
import { describe, expect, it } from "vitest";
import { textOf } from "./line/flex";
import { MSG } from "./line/messages";
import type { FlexMessage } from "./line/types";
import { safetyLine, safetyReasons } from "./safety";

describe("安全のひとこと", () => {
  it("大雪（15cm 以上）・低温（−5℃ 以下）・強風（8m/s 以上）で出る。ふつうの朝は出ない", () => {
    expect(safetyLine({ cm: 12 })).toBeUndefined();
    expect(safetyLine({ cm: 12, tempMinC: -4, windMaxMs: 7 })).toBeUndefined();
    expect(safetyReasons({ cm: 20, tempMinC: -7, windMaxMs: 9 })).toEqual(["heavy", "cold", "wind"]);
    for (const i of [{ cm: 15 }, { cm: 5, tempMinC: -5 }, { cm: 5, windMaxMs: 8 }]) {
      const line = safetyLine(i)!;
      expect(line).toContain("ひとりでやらず");
      expect(line).toContain("休み");
      expect(line).not.toMatch(/しま〜|えな〜/); // 安全の文は丁寧語
    }
    expect(safetyLine({ cm: 5, tempMinC: -8.4 })).toContain("-8℃");
  });

  it("前夜の予告と朝の点呼の隊長カードに、最後の行として必ず入る", () => {
    const line = safetyLine({ cm: 20 })!;
    const eve = MSG.announce("シマエナ隊長だしま〜！明朝 6:30 に点呼します。", 20, "どか雪のモッサリ", line)[0] as FlexMessage;
    const lines = (eve.contents.body?.contents as { text: string }[]).map((x) => x.text);
    expect(lines.at(-1)).toBe(line);
    const morning = MSG.rollcallHelper(20, "どか雪のモッサリ", line);
    expect(textOf(morning[0])).toContain("ひとりでやらず");
    // 雪の量が分からない朝でも、安全の文は落とさない
    expect(textOf(MSG.morningHello(undefined, undefined, line)[0])).toContain("ひとりでやらず");
  });
});
