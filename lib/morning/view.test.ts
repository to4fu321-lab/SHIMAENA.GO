import { describe, expect, it } from "vitest";
import { DEMO_MORNING } from "./sample";
import { progress, snowHp } from "./view";

describe("雪ボスの HP と進み具合（spec v1.1）", () => {
  it("返事なしの家は相手に数えず、完了した分だけ HP が減る", () => {
    // 見本: 8軒のうち返事なし1軒、完了3軒
    expect(snowHp(DEMO_MORNING)).toEqual({ current: 12 * 4, max: 12 * 7 });
    expect(progress(DEMO_MORNING)).toMatchObject({ total: 7, done: 3, left: 4, allDone: false });
  });

  it("相手の家がすべて完了したら討伐。時刻は最後の完了（日本時間）", () => {
    const s = structuredClone(DEMO_MORNING);
    for (const m of s.missions) if (m.status !== "no_answer") m.status = "done";
    s.sorties.push({ ...s.sorties[0], id: "late", status: "done", completedAt: "2026-12-14T07:52:00+09:00" });
    const p = progress(s);
    expect(p.allDone).toBe(true);
    expect(p.left).toBe(0);
    expect(p.defeatedAt).toBe("07:52");
    expect(snowHp(s).current).toBe(0);
  });

  it("作戦の前（ミッションなし）は討伐にならない", () => {
    expect(progress({ ...DEMO_MORNING, missions: [] }).allDone).toBe(false);
  });
});
