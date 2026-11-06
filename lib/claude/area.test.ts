import { describe, expect, it } from "vitest";
import { mockAreaRead, tidyAreaRead } from "./area";

describe("写真から「どこまで」を読む（11/6 本人の指示）", () => {
  it("自信のある答えだけ採用し、理由は30字まで", () => {
    const r = tidyAreaRead({ area: "garage", confidence: "high", reason: "カーポートの前に雪が積もっている。車の屋根も見える。長い長い長い文。", unrelated: false });
    expect(r.area).toBe("garage");
    expect([...r.reason].length).toBeLessThanOrEqual(30);
  });
  it("自信が低い・関係ない写真は選ばない", () => {
    expect(tidyAreaRead({ area: "road", confidence: "low", reason: "暗い", unrelated: false }).area).toBeUndefined();
    const u = tidyAreaRead({ area: "entrance", confidence: "high", reason: "部屋", unrelated: true });
    expect(u.area).toBeUndefined();
    expect(u.unrelated).toBe(true);
  });
  it("名前や番地らしい理由は使わない。キーなしの仮の答えは選ばない", () => {
    expect(tidyAreaRead({ area: "entrance", confidence: "high", reason: "山田さんの玄関", unrelated: false }).reason).toBe("写真から読みました");
    expect(tidyAreaRead(mockAreaRead()).area).toBeUndefined();
  });
});
