import { describe, expect, it } from "vitest";
import { aiLineOk } from "../nakama/rules";
import { bestSlot, countSlots, demoWish, putWish, slotLineNumbers, slotOpen, templateSlotLine } from "./slots";

describe("チームで時間をそろえる（spec v1.39）", () => {
  const w = (participantId: string, when: "am" | "noon" | "pm") => ({ participantId, when, at: "" });

  it("そろう時間は、チームでいちばん多い帯。同じ数なら早いほう。誰もいなければ決めない", () => {
    expect(bestSlot({ am: 1, noon: 3, pm: 2 })).toBe("noon");
    expect(bestSlot({ am: 2, noon: 2, pm: 2 })).toBe("am");
    expect(bestSlot({ am: 0, noon: 1, pm: 1 })).toBe("noon");
    expect(bestSlot({ am: 0, noon: 0, pm: 0 })).toBeUndefined();
  });

  it("数えるのは同じチームのなかまだけ。選べない帯（過ぎた帯）は数えない", () => {
    const wishes = [w("h1", "am"), w("h2", "am"), w("h3", "pm"), w("x9", "pm")];
    expect(countSlots(wishes, ["h1", "h2", "h3"])).toEqual({ am: 2, noon: 0, pm: 1 });
    expect(countSlots(wishes, ["h1", "h2", "h3"], (id) => id !== "am")).toEqual({ am: 0, noon: 0, pm: 1 });
  });

  it("選び直すと、前の選びは置き換わる", () => {
    const a = putWish([w("h1", "am"), w("h2", "pm")], w("h1", "noon"));
    expect(a).toHaveLength(2);
    expect(a.find((x) => x.participantId === "h1")?.when).toBe("noon");
  });

  it("今日の帯は、終わりの 30 分前で締める。明日・デモの日はどれでも選べる", () => {
    const today = "2026-12-14";
    expect(slotOpen("am", today, today, 8 * 60 + 29)).toBe(true);
    expect(slotOpen("am", today, today, 8 * 60 + 30)).toBe(false);
    expect(slotOpen("pm", today, today, 18 * 60)).toBe(true);
    expect(slotOpen("am", "2026-12-15", today, 23 * 60)).toBe(true);
  });

  it("隊長の決まった文は、点検（40字・入力の数字だけ）に通る", () => {
    for (const id of ["am", "noon", "pm"] as const) {
      const t = templateSlotLine("マリーゴールド", id, 3);
      expect(aiLineOk(t, 40, slotLineNumbers(id, 3))).toBe(true);
    }
    expect(templateSlotLine("サルビア", "am", 3)).toBe("サルビアは朝 7:00〜に3人。一緒にそろえませんか？");
    expect(aiLineOk("サルビアは朝 8:00〜に3人。", 40, slotLineNumbers("am", 3))).toBe(false); // 入力にない時刻
  });

  it("デモの架空の人の選びは、いつも同じ（決まった種）で、朝が多い", () => {
    expect(demoWish("h3")).toBe(demoWish("h3"));
    const ids = Array.from({ length: 200 }, (_, i) => `h${i + 1}`);
    const am = ids.filter((id) => demoWish(id) === "am").length;
    expect(am).toBeGreaterThan(80);
    expect(new Set(ids.map(demoWish)).size).toBe(3);
  });
});

import { buildOptions } from "../concierge/options";
describe("隊長トークの候補（spec v1.39）", () => {
  const ctx = { role: "helper" as const, hasTeam: true, answered: false, going: false, shortHouses: 0, soloDoneToday: [], safety: false, firstTime: false, tipOk: false };
  it("雪の日だけ「チームで時間をそろえる」が出る（夜の予告のあとも）", () => {
    expect(buildOptions({ ...ctx, rollcall: "announced", night: true }).map((o) => o.id)).toContain("time");
    expect(buildOptions({ ...ctx, rollcall: "planned" }).map((o) => o.id)).toContain("time");
    expect(buildOptions({ ...ctx, rollcall: "none" }).map((o) => o.id)).not.toContain("time");
    expect(buildOptions({ ...ctx, hasTeam: false, rollcall: "planned" }).map((o) => o.id)).not.toContain("time");
  });
});

import { MSG } from "../line/messages";
describe("知らせに「⏰ チームで時間をそろえる」（spec v1.39）", () => {
  const uris = (ms: unknown[]) => JSON.stringify(ms);
  it("前夜の予告（カード1枚のまま）と、朝の「助けてほしい家」に付く", () => {
    const eve = MSG.announce("明朝 6:30 にお知らせします。", 12, "ぼた雪のドンブリ");
    expect(eve).toHaveLength(1);
    expect(uris(eve)).toContain("/team?tab=time");
    expect(uris(MSG.housesToday(3, true))).toContain("/team?tab=time");
    expect(uris(MSG.housesToday(0, true))).not.toContain("/team?tab=time"); // 待っている家がない朝は出さない
  });
});
