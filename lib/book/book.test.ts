import { describe, expect, it } from "vitest";
import { DEMO_MORNING } from "../morning/sample";
import type { MorningRecord } from "../morning/flow";
import { cleanSvg } from "../cards/svg-clean";
import { bookFacts, weekdayOf } from "./facts";
import { programPage } from "./draw";
import { ROLES, storyProblem, templateStory } from "./story";

const rec = (date: string): MorningRecord => {
  const m = structuredClone(DEMO_MORNING);
  m.rollcall = { ...m.rollcall, id: `rc-${date}`, date };
  for (const x of m.missions) x.snowKg = 120;
  return { morning: m, answers: [], messages: [], briefing: "", clockMin: 0, log: [], thanks: { m1: { choice: "1", label: "ありがとう", sentence: "", at: "", sentTo: 2 } }, cheers: { m1: [{} as never, {} as never] } };
};

describe("町の週刊絵本（v1.27）", () => {
  const f = bookFacts([rec("2026-12-14"), rec("2026-12-16"), rec("2026-12-30")], "2026-12-14", { "2026-12-16": "冬至のゆず湯" });

  it("1週間の事実だけを取り出す（週の外は入れない）", () => {
    expect(f.span).toBe("12月14日〜12月20日");
    expect(f.totals.mornings).toBe(2);
    expect(f.totals.houses).toBe(6); // 見本の朝は3軒完了 × 2
    expect(f.totals.snowKg).toBe(720);
    expect(f.totals.thanks).toBe(2);
    expect(f.totals.cheers).toBe(4);
    expect(f.mornings[0].weekday).toBe("月");
    expect(f.topics).toEqual(["冬至のゆず湯"]);
    expect(f.teams).toHaveLength(3);
    expect(weekdayOf("2026-12-20")).toBe("日");
  });

  it("決まった文は6ページ・名前なし・点検を通る", () => {
    const s = templateStory(f, "しらかば町");
    expect(s.pages.map((p) => p.kind)).toEqual(ROLES.map((r) => r.kind));
    expect(storyProblem(s, f, ["佐藤さん"])).toBeUndefined();
    const quiet = templateStory(bookFacts([], "2027-01-04"), "しらかば町");
    expect(quiet.pages[0].text).toContain("静かな冬");
  });

  it("名前・体のこと・作った数字はだめ", () => {
    const s = templateStory(f, "町");
    const bad = (text: string) => storyProblem({ title: "t", pages: s.pages.map((p, i) => (i === 2 ? { text } : p)) }, f, ["佐藤さん"]);
    expect(bad("佐藤のおうちの前を開きました。")).toMatch(/名前/);
    expect(bad("寒くて体調をくずさないように。")).toMatch(/ことば/);
    expect(bad("雪は999kgもありました。")).toMatch(/数/);
    expect(bad("雪がたくさんふりました。")).toBeUndefined(); // 「たくさん」は名前ではない
  });

  it("プログラムのさし絵は点検を通り、ページごとにちがう", () => {
    const s = templateStory(f, "町");
    const pics = (["cover", ...ROLES.map((r) => r.kind)] as const).map((k) => programPage(k, f, s.style, "2026-12-14|1"));
    expect(new Set(pics).size).toBe(7);
    for (const p of pics) expect(cleanSvg(p, "t")).toBeDefined();
  });
});
