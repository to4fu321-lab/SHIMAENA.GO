import { describe, expect, it, vi } from "vitest";

vi.mock("../claude/client", async (orig) => ({ ...(await orig<typeof import("../claude/client")>()), hasClaudeKey: () => true }));
vi.mock("../claude/art", async (orig) => ({
  ...(await orig<typeof import("../claude/art")>()),
  drawPicture: vi.fn(async () => ({ svg: '<rect width="540" height="560" fill="#123456"/>', why: "見直した絵", rounds: 2, seconds: 1 })),
}));

describe("Claude の絵を、あとから差しかえる（v1.24）", () => {
  it("発行は「描いています」→ 描き上がったら同じカードの表が Claude の絵に", async () => {
    const { repo } = await import("../repo");
    const { renderCardSvg, renderCardBackSvg, isPendingSvg } = await import("./svg");
    const { drawLater } = await import("./drawn");
    const art = { style: "kawaii" as const, designName: "t", designNameEn: "t", rarityLabel: "朝の群れ", stars: 1 as const, members: [{ name: "a" }], date: "2026-12-14", townName: "町", snowKg: 1, snowKgComparison: "x", serial: 1, issuedCount: 1, pending: true, scene: { sky: "day" as const, fall: "powder" as const, ground: 1 as const, props: ["shovel" as const, "tea" as const], mood: "calm" as const, why: "前の理由", code: "ab12" } };
    const card = { id: "c-draw", recipientId: "h1", rollcallId: "rc", missionId: "m", serial: 1, issuedCount: 1, designName: "t", designNameEn: "t", rarityLabel: "x", stars: 1 as const, style: "kawaii" as const, snowKg: 1, snowKgComparison: "x", memberNames: ["a"], teamIds: [], createdAt: new Date().toISOString() };
    await repo().insertCard(card, renderCardSvg(art), renderCardBackSvg(art, { thanks: "ありがとう", subtasks: [], firstFlight: false }));
    expect(isPendingSvg((await repo().getCard("c-draw"))!.svg)).toBe(true);
    drawLater([{ id: "c-draw", art }], { date: "2026-12-14", completedAtJst: "07:05", sky: "昼の光", fall: "粉雪", groundCm: 10, members: [], style: "kawaii", mood: "静か", props: [], designName: "t", seed: "s" });
    await vi.waitFor(async () => expect(isPendingSvg((await repo().getCard("c-draw"))!.svg)).toBe(false));
    const got = (await repo().getCard("c-draw"))!;
    expect(got.svg).toContain('fill="#123456"');
    expect(got.backSvg).toContain("見直した絵");
  });
});
