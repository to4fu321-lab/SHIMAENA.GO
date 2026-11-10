import { describe, expect, it } from "vitest";
import { formatKg } from "../snowkg";
import { DEMO_MORNING } from "./sample";
import { mySortieOf, progress, snowHp, snowTotal } from "./view";

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

  it("どけた雪の合計は、完了した家の kg だけを足し、身近な換算と t 表示になる（spec v1.2）", () => {
    expect(snowTotal(DEMO_MORNING).kg).toBe(0); // 見本には kg がない
    const s = structuredClone(DEMO_MORNING);
    s.missions.find((m) => m.id === "m1")!.snowKg = 900;
    s.missions.find((m) => m.id === "m2")!.snowKg = 600;
    s.missions.find((m) => m.id === "m3")!.snowKg = 500; // まだ終わっていない家は数えない
    const t = snowTotal(s);
    expect(t).toMatchObject({ kg: 1500, houses: 2, label: "1.5t", comparison: "軽トラ2台分" });
    expect(formatKg(800)).toBe("800kg");
    expect(formatKg(1000)).toBe("1t");
  });
});

describe("見ている人の出動（地図の「終わりました」）", () => {
  const base = { teamId: "salvia" as const, subtaskIds: [] as string[], rescue: false };
  it("1軒終えて別の家に加わったら、いま向かっている家を選ぶ（写真で完了できる）", () => {
    const sorties = [
      { ...base, id: "a", missionId: "m1", participantId: "h1", status: "done" as const },
      { ...base, id: "b", missionId: "m2", participantId: "h1", status: "going" as const, rescue: true },
    ];
    expect(mySortieOf(sorties, "h1")?.missionId).toBe("m2");
  });
  it("向かっている家がなければ最後の出動。出動がなければ undefined", () => {
    const sorties = [
      { ...base, id: "a", missionId: "m1", participantId: "h1", status: "done" as const },
      { ...base, id: "b", missionId: "m2", participantId: "h1", status: "done" as const },
    ];
    expect(mySortieOf(sorties, "h1")?.missionId).toBe("m2");
    expect(mySortieOf(sorties, "h9")).toBeUndefined();
  });
});
