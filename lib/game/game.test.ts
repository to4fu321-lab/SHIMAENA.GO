import { describe, expect, it } from "vitest";
import type { Participant, Sortie, TeamId } from "../types";
import { decompose, importance, requiredPeople, SUPPORT_TASKS } from "./mission";
import { isEarly, POINTS, scoreMission, scoreSupport, scoreWeeklyGoal, totalsByTeam } from "./score";
import { distanceM, helpTargets, HELP_RADII, shouldTriggerHelp } from "./help";
import { shuffleTeams, weekStart, weeklyTitle } from "./week";

const AT = "2026-12-14T07:10:00+09:00";
const sortie = (participantId: string, teamId: TeamId, opts: Partial<Sortie> = {}): Sortie => ({
  id: `s-${participantId}`,
  missionId: "m1",
  participantId,
  teamId,
  subtaskIds: [],
  status: "done",
  rescue: false,
  completedAt: "2026-12-14T07:10:00+09:00",
  ...opts,
});
const sum = (events: { points: number; reason: string }[], reason?: string) =>
  events.filter((e) => !reason || e.reason === reason).reduce((s, e) => s + e.points, 0);

describe("得点表（spec 5 の全行）", () => {
  it("ミッション完了: 1人につき 10", () => {
    const e = scoreMission([sortie("a", "salvia", { completedAt: "2026-12-14T08:00:00+09:00" })], AT);
    expect(sum(e, "mission_done")).toBe(10);
  });

  it("7:30 までに完了: +5（7:30 ちょうどは含み、7:31 は含まない）", () => {
    expect(isEarly("2026-12-14T07:30:00+09:00")).toBe(true);
    expect(isEarly("2026-12-14T07:31:00+09:00")).toBe(false);
    const e = scoreMission([sortie("a", "salvia")], AT);
    expect(sum(e, "early")).toBe(5);
  });

  it("赤点滅の家に駆けつけ: +10", () => {
    const e = scoreMission([sortie("a", "salvia", { rescue: true })], AT);
    expect(sum(e, "rescue")).toBe(10);
  });

  it("同じチーム2人以上で1軒: 各 +5（1人だけなら付かない）", () => {
    expect(sum(scoreMission([sortie("a", "salvia"), sortie("b", "salvia")], AT), "flock")).toBe(10);
    expect(sum(scoreMission([sortie("a", "salvia")], AT), "flock")).toBe(0);
  });

  it("2チームが同じ家で合流: 両チームに +5", () => {
    const e = scoreMission([sortie("a", "salvia"), sortie("b", "lupinus")], AT);
    const mixed = e.filter((x) => x.reason === "mixed");
    expect(mixed.map((x) => x.teamId).sort()).toEqual(["lupinus", "salvia"]);
    expect(sum(mixed)).toBe(10);
  });

  it("偵察・補給: 3", () => {
    expect(scoreSupport("scout", "marigold", "a", AT).points).toBe(3);
    expect(scoreSupport("supply", "marigold", "a", AT).points).toBe(3);
  });

  it("依頼者本人の参加: 3（人数の多いチームに入る）", () => {
    const e = scoreMission([sortie("a", "salvia"), sortie("b", "lupinus"), sortie("c", "lupinus")], AT, true);
    const joined = e.filter((x) => x.reason === "requester_joined");
    expect(joined).toHaveLength(1);
    expect(joined[0]).toMatchObject({ teamId: "lupinus", points: 3 });
  });

  it("週の目標（全軒 8:00 までに完了）: チーム全員に +20。1軒でも遅れたら付かない", () => {
    const ok = scoreWeeklyGoal("salvia", ["2026-12-14T07:50:00+09:00", "2026-12-15T07:10:00+09:00"], ["a", "b", "c"], AT);
    expect(sum(ok)).toBe(60);
    expect(scoreWeeklyGoal("salvia", ["2026-12-14T07:50:00+09:00", "2026-12-15T08:05:00+09:00"], ["a"], AT)).toEqual([]);
    expect(scoreWeeklyGoal("salvia", ["2026-12-14T07:50:00+09:00", null], ["a"], AT)).toEqual([]);
  });

  it("週の出撃日数: 3日で称号、5日で称号＋レアカード確定", () => {
    expect(weeklyTitle(2)).toEqual({ title: null, rareCard: false });
    expect(weeklyTitle(3)).toMatchObject({ rareCard: false });
    expect(weeklyTitle(3).title).not.toBeNull();
    expect(weeklyTitle(5)).toMatchObject({ rareCard: true });
  });

  it("未完了の出撃は得点にならない", () => {
    expect(scoreMission([sortie("a", "salvia", { status: "going" })], AT)).toEqual([]);
  });

  it("全部入りの例: 青2人（早朝・群れ）＋紫1人（駆けつけ）＋依頼者", () => {
    const e = scoreMission([sortie("a", "salvia"), sortie("b", "salvia"), sortie("c", "lupinus", { rescue: true })], AT, true);
    const t = totalsByTeam(e);
    // 青: 完了10×2 + 早朝5×2 + 群れ5×2 + 混成5 + 依頼者3 = 48
    expect(t.salvia).toBe(48);
    // 紫: 完了10 + 早朝5 + 駆けつけ10 + 混成5 = 30
    expect(t.lupinus).toBe(30);
    expect(t.marigold).toBe(0);
    expect(POINTS.weekly_goal).toBe(20);
  });
});

describe("重要度と必要人数", () => {
  it("「いいえ」はレベルが同じなら「一緒なら」より重要度が高い", () => {
    expect(importance(2, "no")).toBeGreaterThan(importance(2, "together"));
    expect(importance(3, "no")).toBeGreaterThan(importance(1, "no"));
    expect(importance(2, "none")).toBeGreaterThan(importance(2, "together"));
  });

  it("必要人数はレベルの数。「一緒なら」は1人減る（最低1人）。「はい」は0人", () => {
    expect(requiredPeople(3, "no")).toBe(3);
    expect(requiredPeople(3, "together")).toBe(2);
    expect(requiredPeople(1, "together")).toBe(1);
    expect(requiredPeople(2, "yes")).toBe(0);
  });
});

describe("小タスク分解", () => {
  it("どれも10・20・30分のどれか", () => {
    for (const t of [...decompose("road", 3), ...SUPPORT_TASKS]) expect([10, 20, 30]).toContain(t.minutes);
  });

  it("玄関前だけなら車庫前・道路までは入らない", () => {
    const kinds = decompose("entrance", 1).map((t) => t.kind);
    expect(kinds).toContain("path");
    expect(kinds).not.toContain("garage");
    expect(kinds).not.toContain("road");
  });

  it("道路までなら車庫前と道路までが入り、雪捨ての往復はレベルの数", () => {
    const tasks = decompose("road", 3);
    expect(tasks.map((t) => t.kind)).toEqual(expect.arrayContaining(["garage", "road"]));
    expect(tasks.filter((t) => t.kind === "dump")).toHaveLength(3);
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length);
  });

  it("偵察と補給はいつでもある5分タスク", () => {
    expect(SUPPORT_TASKS.map((t) => t.kind)).toEqual(["scout", "supply"]);
  });
});

describe("ヘルプ通知", () => {
  const start = new Date("2026-12-14T07:00:00+09:00");
  it("開始20分前を過ぎて人数不足なら発火、まだ早ければ発火しない", () => {
    expect(shouldTriggerHelp({ now: new Date("2026-12-14T06:45:00+09:00"), startAt: start, going: 1, required: 3 })).toBe(true);
    expect(shouldTriggerHelp({ now: new Date("2026-12-14T06:30:00+09:00"), startAt: start, going: 1, required: 3 })).toBe(false);
    expect(shouldTriggerHelp({ now: new Date("2026-12-14T06:45:00+09:00"), startAt: start, going: 3, required: 3 })).toBe(false);
  });

  it("ボタンや新しい「いいえ」なら時刻に関係なく発火", () => {
    const early = new Date("2026-12-14T06:00:00+09:00");
    expect(shouldTriggerHelp({ now: early, startAt: start, going: 3, required: 3, shortButtonPressed: true })).toBe(true);
    expect(shouldTriggerHelp({ now: early, startAt: start, going: 3, required: 3, newNoAfterPlan: true })).toBe(true);
  });

  it("半径は 300m → 600m → 1km と広がり、段階ごとに重ならない", () => {
    expect(HELP_RADII).toEqual([300, 600, 1000]);
    const base: [number, number] = [43.04, 141.37];
    const at = (m: number): Participant => ({
      id: `h${m}`,
      nickname: "x",
      role: "helper",
      location: [base[0] + m / 111320, base[1]],
    });
    const helpers = [at(100), at(250), at(450), at(900), at(1500)];
    const none = new Set<string>();
    expect(helpTargets(base, helpers, 0, none).map((h) => h.id)).toEqual(["h100", "h250"]);
    expect(helpTargets(base, helpers, 1, none).map((h) => h.id)).toEqual(["h450"]);
    expect(helpTargets(base, helpers, 2, none).map((h) => h.id)).toEqual(["h900"]);
    expect(helpTargets(base, helpers, 0, new Set(["h100"])).map((h) => h.id)).toEqual(["h250"]);
    expect(Math.round(distanceM(base, at(450).location))).toBe(450);
  });
});

describe("週とシャッフル", () => {
  it("週は日曜はじまり", () => {
    expect(weekStart("2026-12-14")).toBe("2026-12-14"); // 月曜はその日
    expect(weekStart("2026-12-13")).toBe("2026-12-07"); // 日曜は週の最後の日（前の月曜から）
    expect(weekStart("2026-12-19")).toBe("2026-12-14"); // 土曜
  });

  const helpers: Participant[] = Array.from({ length: 12 }, (_, i) => ({
    id: `h${i}`,
    nickname: `h${i}`,
    role: "helper",
    location: [43.04, 141.37],
    morningMinutes: ([15, 30, 60] as const)[i % 3],
  }));
  const sorties = Object.fromEntries(helpers.map((h, i) => [h.id, i % 5]));

  it("3チームに4人ずつ配られ、強さの合計の差が小さい", () => {
    const result = shuffleTeams(helpers, sorties, 42);
    const counts = { salvia: 0, marigold: 0, lupinus: 0 };
    const power = { salvia: 0, marigold: 0, lupinus: 0 };
    for (const h of helpers) {
      counts[result[h.id]]++;
      power[result[h.id]] += sorties[h.id] * 10 + (h.morningMinutes ?? 15) / 15;
    }
    expect(Object.values(counts)).toEqual([4, 4, 4]);
    const p = Object.values(power);
    expect(Math.max(...p) - Math.min(...p)).toBeLessThanOrEqual(Math.max(...p) * 0.35);
  });

  it("同じ種なら同じ結果、違う週なら組み合わせが変わる", () => {
    expect(shuffleTeams(helpers, sorties, 42)).toEqual(shuffleTeams(helpers, sorties, 42));
    const weeks = [1, 2, 3, 4, 5].map((s) => JSON.stringify(shuffleTeams(helpers, sorties, s)));
    expect(new Set(weeks).size).toBeGreaterThan(1);
  });
});
