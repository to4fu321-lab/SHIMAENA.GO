import { beforeEach, describe, expect, it } from "vitest";
import { teamTotals } from "../morning/view";
import { announce } from "../morning/ops";
import { DEMO_DATE } from "../morning/flow";
import { loadMorning } from "../morning/store";
import { appToday, dayDiff } from "../morning/today";
import { memoryRepo } from "../repo";
import type { SoloLog } from "../types";
import { activeDates, bonusesDue, feathersOn, nextCard, streakDays, totalFeathers } from "./feathers";
import { SOLO_MISSIONS, soloMission } from "./missions";
import { completeSolo, recordHouseFeathers, soloStatus } from "./ops";

const log = (date: string, kind: SoloLog["kind"] = "patrol", feathers = 5): SoloLog => ({
  id: `${date}-${kind}`,
  participantId: "h3",
  date,
  kind,
  onsite: true,
  feathers,
  at: `${date}T07:00:00+09:00`,
});

describe("ミッションの一覧", () => {
  it("現地とオンラインがはっきり分かれ、オンラインは羽が少ない", () => {
    const onsite = SOLO_MISSIONS.filter((m) => m.onsite);
    const online = SOLO_MISSIONS.filter((m) => !m.onsite);
    expect(onsite.length).toBeGreaterThanOrEqual(5);
    expect(online.length).toBe(3);
    for (const m of online) expect(m.minutes).toBe(3);
    expect(Math.max(...online.map((m) => m.feathers))).toBeLessThan(Math.min(...onsite.map((m) => m.feathers)));
    expect(soloMission("own_house")?.photo).toBe("optional");
  });
});

describe("羽と連続出動（純粋な関数）", () => {
  it("合計と今日の羽", () => {
    const logs = [log("2026-12-13"), log("2026-12-14", "own_house", 8), log("2026-12-14", "bonus_first", 3)];
    expect(totalFeathers(logs)).toBe(16);
    expect(feathersOn(logs, "2026-12-14")).toBe(11);
  });

  it("連続出動日数: 今日があれば今日から、なければ昨日から、どちらもなければ 0", () => {
    const d = activeDates([log("2026-12-12"), log("2026-12-13"), log("2026-12-14")]);
    expect(streakDays(d, "2026-12-14")).toBe(3);
    expect(streakDays(d, "2026-12-15")).toBe(3); // 今日まだでも昨日まで続いている
    expect(streakDays(d, "2026-12-16")).toBe(0);
    expect(streakDays(activeDates([log("2026-12-10"), log("2026-12-12")]), "2026-12-12")).toBe(1);
    expect(streakDays(activeDates([log("2026-12-14", "bonus_first")]), "2026-12-14")).toBe(0); // ボーナスは日数に数えない
  });

  it("ボーナスは初回1回・同じ連続の中で1回だけ", () => {
    const d1 = [log("2026-12-14")];
    expect(bonusesDue(d1, "2026-12-14")).toEqual(["bonus_first"]);
    const d2 = [...d1, log("2026-12-14", "bonus_first", 3)];
    expect(bonusesDue(d2, "2026-12-14")).toEqual([]);
    const three = [log("2026-12-12"), log("2026-12-13"), log("2026-12-14"), log("2026-12-12", "bonus_first", 3)];
    expect(bonusesDue(three, "2026-12-14")).toEqual(["bonus_streak3"]);
    const given = [...three, log("2026-12-14", "bonus_streak3", 5), log("2026-12-15")];
    expect(bonusesDue(given, "2026-12-15")).toEqual([]);
    const five = [...given, log("2026-12-16")];
    expect(bonusesDue(five, "2026-12-16")).toEqual(["bonus_streak5"]);
    // 途切れて新しい連続が3日になれば、また 3日のボーナス
    const again = [...five, log("2026-12-16", "bonus_streak5", 10), log("2026-12-20"), log("2026-12-21"), log("2026-12-22")];
    expect(bonusesDue(again, "2026-12-22")).toEqual(["bonus_streak3"]);
  });

  it("次に獲得できるカード", () => {
    expect(nextCard([], 0).label).toContain("はじめて");
    const first = { style: "kawaii" } as Parameters<typeof nextCard>[0][number];
    expect(nextCard([first], 2).daysLeft).toBe(3);
  });
});

describe("アプリの今日", () => {
  it("点呼の日付が本当の日付の前後1日なら本当の日付、デモの 12 月なら点呼の日付", () => {
    const rec = { morning: { rollcall: { date: DEMO_DATE } } } as Parameters<typeof appToday>[0];
    expect(appToday(rec, new Date("2026-11-03T12:00:00Z"))).toBe(DEMO_DATE);
    expect(appToday(rec, new Date("2026-12-14T23:30:00Z"))).toBe("2026-12-15"); // JST では 12/15 の朝
    expect(dayDiff("2026-12-15", "2026-12-14")).toBe(1);
  });
});

describe("completeSolo（台帳・カード・チーム得点）", () => {
  beforeEach(() => {
    for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive"]) delete (globalThis as Record<string, unknown>)[k];
  });
  const now = new Date("2026-11-03T12:00:00Z");

  it("1日1回、初回はボーナスとカード、羽はチーム得点に入らない", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    const before = await loadMorning();
    const scoresBefore = before.morning.scores.length;
    const r1 = await completeSolo("h3", "patrol", { now });
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.summary.feathers).toBe(5);
    expect(r1.summary.bonuses.map((b) => b.label)).toEqual(["初回出動"]);
    expect(r1.summary.todayFeathers).toBe(8);
    expect(r1.summary.streak).toBe(1);
    expect(r1.summary.firstEver).toBe(true);
    expect(r1.summary.card?.style).toBe("kawaii");
    expect(r1.summary.card?.rollcallId).toBe(`solo-${DEMO_DATE}`);
    expect(r1.summary.hitokoto.length).toBeLessThanOrEqual(30);
    const after = await loadMorning();
    expect(after.morning.scores.length).toBe(scoresBefore);
    expect(teamTotals(after.morning)).toEqual(teamTotals(before.morning));

    const r2 = await completeSolo("h3", "patrol", { now });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe("already");
    const r3 = await completeSolo("h3", "check_area", { now });
    expect(r3.ok).toBe(true);
    if (r3.ok) {
      expect(r3.summary.onsite).toBe(false);
      expect(r3.summary.bonuses).toEqual([]);
      expect(r3.summary.card).toBeUndefined();
    }
    const st = await soloStatus("h3", now);
    expect(st.today).toBe(DEMO_DATE);
    expect(st.todayFeathers).toBe(10);
    expect(st.doneToday.sort()).toEqual(["check_area", "patrol"]);
    expect(st.cards).toBe(1);
    expect((await memoryRepo.listSoloLogsByParticipant("h3")).every((l) => !("lat" in l))).toBe(true);
  });

  it("チームのない依頼者も「自分の家の雪かき」ができる。家の完了は missionId ごとに1回", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    const r = await completeSolo("r2", "own_house", { now });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.summary.card?.teamIds).toEqual([]);
    expect(await completeSolo("h1", "help_house", { now })).toMatchObject({ ok: false, reason: "help_house" });
    expect(await completeSolo("nobody", "patrol", { now })).toMatchObject({ ok: false, reason: "not_registered" });

    const ps = [{ id: "h1", location: [43.04, 141.37] as [number, number] }];
    expect(await recordHouseFeathers(ps, { missionId: "m-base1", today: DEMO_DATE, now })).toBe(1);
    expect(await recordHouseFeathers(ps, { missionId: "m-base1", today: DEMO_DATE, now })).toBe(0);
    expect(await recordHouseFeathers(ps, { missionId: "m-base2", today: DEMO_DATE, now })).toBe(1);
    const logs = await memoryRepo.listSoloLogsByParticipant("h1");
    expect(logs.filter((l) => l.kind === "help_house")).toHaveLength(2);
    expect(logs.filter((l) => l.kind === "bonus_first")).toHaveLength(1);
    expect(totalFeathers(logs)).toBe(23);
  });
});

describe("初参加の歓迎（T39）", () => {
  beforeEach(() => {
    for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive"]) delete (globalThis as Record<string, unknown>)[k];
  });

  it("次のおすすめは、今日まだの外の5分ミッション", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    const now = new Date("2026-11-03T12:00:00Z");
    const r1 = await completeSolo("h4", "patrol", { now });
    expect(r1.ok && r1.summary.nextMission).toBe("雪の多い場所を報告する");
    const r2 = await completeSolo("h4", "report_snow", { now });
    expect(r2.ok && r2.summary.nextMission).toBe("雪かき可能な場所を確認する");
  });

  it("LINE 登録が終わったら、ソロ出動への1行が届く（家族の代理登録には付けない）", async () => {
    const { finishRegistration } = await import("../line/handle");
    const helper = await finishRegistration("U-test-helper", { role: "helper", location: [43.04, 141.37], morningMinutes: 15, hasTools: true });
    expect(helper.map((m) => (m as { text?: string }).text ?? "").join("\n")).toContain("ソロ出動");
    const req = await finishRegistration("U-test-req", { role: "requester", location: [43.04, 141.37], soloMinutes: 30, clearArea: "entrance", proxy: false });
    expect(req.map((m) => (m as { text?: string }).text ?? "").join("\n")).toContain("ソロ出動");
    const proxy = await finishRegistration("U-test-family", { role: "requester", location: [43.04, 141.37], soloMinutes: 30, clearArea: "entrance", proxy: true });
    expect(proxy.map((m) => (m as { text?: string }).text ?? "").join("\n")).not.toContain("ソロ出動");
  });
});
