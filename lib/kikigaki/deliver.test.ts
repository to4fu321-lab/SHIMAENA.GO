import { describe, expect, it, vi } from "vitest";
import { seedDemoStory } from "./ops";
import { runSimulation } from "../sim/run";
import { listThread } from "../inbox/store";

describe("雪の聞き書きが、雪かきの完了で届く（v1.26）", () => {
  it("お話を届けると決めた家が終わると、来た人の隊長トークとカードの裏に", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await seedDemoStory("r101"); // テストモードの拠点1の家
    const r = await runSimulation();
    const house = r.missions.find((m) => m.number === 1)!;
    const cards = r.cards.filter((c) => house.members.includes(c.recipient));
    expect(cards.length).toBe(house.members.length);
    for (const c of cards) expect(c.backSvg).toContain("この家の雪の思い出「坂道とそりの冬」が届いています");
    const helperId = r.helpers.find((h) => h.nickname === house.members[0])!.id;
    const thread = await listThread(`demo:${helperId}`);
    expect(thread.some((x) => JSON.stringify(x.body).includes("この家の雪の思い出が届きました"))).toBe(true);
    expect(r.log.some((l) => l.includes("雪の思い出「坂道とそりの冬」を"))).toBe(true);
    // ほかの家のカードには出ない
    expect(r.cards.filter((c) => !house.members.includes(c.recipient)).every((c) => !c.backSvg.includes("雪の思い出"))).toBe(true);
  }, 60_000);
});
