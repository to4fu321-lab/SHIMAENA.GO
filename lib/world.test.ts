// 町は2つ（spec v1.70）: 本番の町（本当の天気）とサンプルの町（いつも雪の朝）が、互いに混ざらないこと。
import { describe, expect, it } from "vitest";
import { ensureDemoMorning } from "./morning/demo-start";
import { rosterOf, TOWN_ROSTER, loadRoster } from "./morning/roster";
import { loadMorning, saveMorning } from "./morning/store";
import { appToday } from "./morning/today";
import { isNight } from "./night";
import { repo } from "./repo";
import { currentWorld, inWorld, keepWorld, worldOf } from "./world";

const NIGHT = new Date("2026-12-14T13:00:00Z"); // 日本時間 22:00

describe("町を決める", () => {
  it("架空の人はサンプル、本物の人・だれでもない人は本番", () => {
    expect(worldOf("h3")).toBe("demo");
    expect(worldOf("r2")).toBe("demo");
    expect(worldOf("p-8f3a")).toBe("real");
    expect(worldOf(undefined)).toBe("real");
  });

  it("決めていなければ undefined（今までどおりの1つの町）。inWorld の中と、あとで動かす仕事には引きつがれる", async () => {
    expect(currentWorld()).toBeUndefined();
    const later = await inWorld("real", async () => {
      await Promise.resolve();
      expect(currentWorld()).toBe("real");
      return keepWorld(() => currentWorld());
    });
    expect(currentWorld()).toBeUndefined();
    expect(later()).toBe("real");
  });
});

describe("名簿", () => {
  const real = { id: "p-1", nickname: "ほんもの", role: "requester" as const, location: [43.04, 141.37] as [number, number], lineUserId: "U1" };
  const all = { participants: [...TOWN_ROSTER.participants, real], bases: [...TOWN_ROSTER.bases, { id: "base-p-1", number: 9, requesterId: "p-1" }] };

  it("本番の町は本物の人とその家だけ、サンプルの町は架空の人と架空の家だけ", () => {
    const r = rosterOf(all, "real");
    expect(r.participants.map((p) => p.id)).toEqual(["p-1"]);
    expect(r.bases.map((b) => b.id)).toEqual(["base-p-1"]);
    const d = rosterOf(all, "demo");
    expect(d.participants).toHaveLength(TOWN_ROSTER.participants.length);
    expect(d.bases.some((b) => b.requesterId === "p-1")).toBe(false);
    expect(rosterOf(all, undefined)).toBe(all);
  });

  it("loadRoster は、いまの町で絞る", async () => {
    await repo().upsertParticipant(real);
    expect((await inWorld("real", loadRoster)).participants.map((p) => p.id)).toEqual(["p-1"]);
    expect((await inWorld("demo", loadRoster)).participants.some((p) => p.id === "p-1")).toBe(false);
  });
});

describe("今朝の状態は町ごとに別", () => {
  it("本番の町は、雪の知らせのないふつうの日から始まる。サンプルの町は雪 12cm の朝", async () => {
    const real = await inWorld("real", loadMorning);
    expect(real.morning.rollcall.status).toBe("closed");
    expect(real.morning.missions).toHaveLength(0);
    const sample = await inWorld("demo", loadMorning);
    expect(sample.morning.rollcall.forecastCm).toBe(12);
    expect(sample.morning.missions.length).toBeGreaterThan(0);
    expect(await loadMorning()).toBe(sample); // 決めていない入口は、サンプルと同じ記録（今までどおり）
  });

  it("サンプルの雪の朝を作り直しても、本番の町は変わらない", async () => {
    const before = structuredClone(await inWorld("real", loadMorning));
    await inWorld("demo", async () => {
      const s = await loadMorning();
      s.morning.rollcall.status = "closed"; // 終わった朝 → 人をえらぶと作り直される
      await saveMorning(s);
    });
    expect(await ensureDemoMorning()).toBe(true);
    expect((await inWorld("demo", loadMorning)).morning.rollcall.status).toBe("planned");
    expect(await inWorld("real", loadMorning)).toEqual(before);
  });
});

describe("時計", () => {
  it("本番の町は、夜は夜（よその家は明るい時間に）", () => {
    expect(inWorld("real", () => isNight(NIGHT))).toBe(true);
    expect(inWorld("real", () => isNight(new Date("2026-12-14T01:00:00Z")))).toBe(false);
  });

  it("本番の町の「今日」は、いつでも本当の日付", async () => {
    const old = { morning: { rollcall: { date: "2026-12-01" } } } as Parameters<typeof appToday>[0];
    expect(inWorld("real", () => appToday(old, NIGHT))).toBe("2026-12-14");
    expect(appToday(old, NIGHT)).toBe("2026-12-01"); // サンプルは、見本の朝の日付のまま
  });
});
