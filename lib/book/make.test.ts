import { describe, expect, it, vi } from "vitest";

vi.mock("../claude/client", async (orig) => ({
  ...(await orig<typeof import("../claude/client")>()),
  hasClaudeKey: () => true,
  askJson: vi.fn(async () => {
    throw new Error("テストでは文を決まった文に");
  }),
}));
vi.mock("../topic/day", () => ({ dayTopic: vi.fn(async () => ({ items: [{ label: "大雪", hint: "", motif: "crystal" }] })) }));
vi.mock("../claude/illustrate", async (orig) => ({
  ...(await orig<typeof import("../claude/illustrate")>()),
  drawIllustration: vi.fn(async () => ({ svg: '<rect width="600" height="450" fill="#123456"/>', rounds: 2 })),
}));

describe("週刊絵本を作る（v1.27）", () => {
  it("すぐ読める形で保存 → Claude のさし絵が描けたページから差しかわり、全部終わると done", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { makeBook, currentWeekStart } = await import("./make");
    const { loadBook } = await import("./store");
    const week = await currentWeekStart(new Date("2026-12-14T08:00:00+09:00"));
    expect(week).toBe("2026-12-14");
    const b = await makeBook(week);
    expect(b.status).toBe("drawing");
    expect(b.pages).toHaveLength(6);
    expect(b.pages.every((p) => p.drawnBy === "program" && p.svg)).toBe(true);
    expect(b.by).toBe("template");
    await vi.waitFor(async () => expect((await loadBook(week))?.status).toBe("done"));
    const done = (await loadBook(week))!;
    expect(done.drawn).toBe(7);
    expect(done.cover.drawnBy).toBe("claude");
    expect(done.pages.every((p) => p.svg?.includes("#123456"))).toBe(true);
  });
});
