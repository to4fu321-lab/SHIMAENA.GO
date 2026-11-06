import { describe, expect, it } from "vitest";
import { listThread } from "../inbox/store";
import { textOf } from "../line/flex";
import { demoTalks, seedDemoTalk } from "./demo-talk";
import { TOWN_ROSTER } from "./roster";
import { loadMorning } from "./store";

describe("デモの隊長トークを見本の朝にそろえる", () => {
  it("拠点2を終えた h3 には、おはよう → 拠点2の作戦 → 完了。拠点2をお願いした人には完了の知らせ", async () => {
    const record = await loadMorning();
    const talks = demoTalks(record, TOWN_ROSTER);
    const h3 = talks.filter((t) => t.key === "demo:h3").flatMap((t) => t.messages.map(textOf)).join(" ");
    expect(h3).toContain("拠点2へ");
    expect(h3).toContain("拠点2は");
    const base2 = TOWN_ROSTER.bases.find((b) => b.id === "base2")!;
    const req = talks.filter((t) => t.key === `demo:${base2.requesterId}`).flatMap((t) => t.messages.map(textOf)).join(" ");
    expect(req).toContain("雪かきが終わりました");
    // 本物の人の鍵（LINE の ID）は作らない
    expect(talks.every((t) => t.key.startsWith("demo:"))).toBe(true);
  });

  it("何度入れ直しても同じ数（重ならない）", async () => {
    const record = await loadMorning();
    await seedDemoTalk(record, TOWN_ROSTER);
    const once = (await listThread("demo:h3")).length;
    await seedDemoTalk(record, TOWN_ROSTER);
    expect((await listThread("demo:h3")).length).toBe(once);
    expect(once).toBeGreaterThan(0);
  });
});
