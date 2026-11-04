import { describe, expect, it } from "vitest";
import { arrivalLines, cheerNews, markSeen, notYetSent, sendCheers, tenths, type HomeCheers } from "./home-cheer";

const D = "2026-12-14";

describe("自宅の雪かきへの応援・おつかれさま", () => {
  it("1日に1回ずつ。自分には送れない。聞いたら消える", () => {
    const rec: { homeCheers?: HomeCheers } = {};
    expect(sendCheers(rec, D, "a", "cheer", ["b", "c", "a"]).sent).toBe(2);
    expect(sendCheers(rec, D, "a", "cheer", ["b"]).sent).toBe(0);
    expect(sendCheers(rec, D, "d", "thanks", ["b"]).sent).toBe(1);
    expect(notYetSent(rec, D, "a", "cheer", ["b", "c", "e"])).toEqual(["e"]);
    expect(cheerNews(rec, D, "b")).toEqual({ newCheer: 1, newThanks: 1, total: 2 });
    expect(arrivalLines(cheerNews(rec, D, "b")!)).toEqual([
      "1人が、あなたを応援してるえな〜！📣",
      "1人から、おつかれさまの差入れしま〜！🍵",
      "今日の応援ポイント +0.2（1人 0.1）えな〜！",
    ]);
    expect(markSeen(rec, D, "b")).toBe(true);
    expect(cheerNews(rec, D, "b")).toBeUndefined();
  });
  it("10人分でチーム +1点、1日 2点まで。日が変わったら数え直す", () => {
    const rec: { homeCheers?: HomeCheers } = {};
    const pts: string[] = [];
    for (let i = 0; i < 35; i++) pts.push(...sendCheers(rec, D, `p${i}`, i % 2 ? "cheer" : "thanks", ["t"]).pointTo);
    expect(pts).toEqual(["t", "t"]);
    sendCheers(rec, "2026-12-15", "x", "cheer", ["t"]);
    expect(cheerNews(rec, "2026-12-15", "t")?.total).toBe(1);
    expect(tenths(12)).toBe("1.2");
  });
});
