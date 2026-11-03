import { describe, expect, it } from "vitest";
import { mockPlan } from "../claude/commander";
import { POINTS } from "../game/score";
import type { ScoreReason } from "../types";
import { breakdown, eventsForMission, latestClear, REASON_LABEL, summarizeClear } from "./clear";
import { applyPlan, commanderInput, completeNext, emptyMorning, fillAnswers, ringRollcall } from "./flow";
import { TOWN_ROSTER as R } from "./roster";
import { snowHp } from "./view";

function morningWithOneDone() {
  const s = emptyMorning();
  ringRollcall(s);
  fillAnswers(s, R, 7);
  applyPlan(s, R, mockPlan(commanderInput(s, R)));
  const hpBefore = snowHp(s.morning).current;
  const missionId = completeNext(s, R)!;
  return { s, missionId, hpBefore };
}

describe("MISSION CLEAR のまとめ（spec v1.1）", () => {
  it("得点表のすべての理由にラベルがある", () => {
    for (const r of Object.keys(POINTS) as ScoreReason[]) expect(REASON_LABEL[r]).toBeTruthy();
  });

  it("その家の完了で入った点だけを数え、内訳の合計と一致する", () => {
    const { s, missionId, hpBefore } = morningWithOneDone();
    const c = summarizeClear(s.morning, R, missionId, { hpBefore })!;
    const sorties = s.morning.sorties.filter((x) => x.missionId === missionId);
    expect(c.members).toHaveLength(sorties.length);
    expect(c.items.reduce((a, i) => a + i.points, 0)).toBe(c.totalPoints);
    expect(c.totalPoints).toBe(s.morning.scores.reduce((a, e) => a + e.points, 0)); // 1軒目なので全部この家の分
    expect(c.items[0]).toMatchObject({ reason: "mission_done", count: sorties.length, points: POINTS.mission_done * sorties.length });
    expect(c.hpBefore - c.hpAfter).toBe(s.morning.rollcall.forecastCm);
    expect(c.allDone).toBe(false);
  });

  it("2軒目が終わると、最近の完了は2軒目になり、1軒目の点は混ざらない", () => {
    const { s, missionId: first } = morningWithOneDone();
    const second = completeNext(s, R)!;
    expect(second).not.toBe(first);
    expect(latestClear(s.morning, R)!.missionId).toBe(second);
    const firstEvents = eventsForMission(s.morning, first);
    const secondEvents = eventsForMission(s.morning, second);
    expect(firstEvents.length + secondEvents.length).toBe(s.morning.scores.length);
    expect(summarizeClear(s.morning, R, second)!.hpBefore - summarizeClear(s.morning, R, second)!.hpAfter).toBe(12);
  });

  it("あとから終わった家の時刻が前より古くても（デモの時計と本当の時刻の混在）、最近の完了はあとの家", () => {
    const { s, missionId: first } = morningWithOneDone();
    const second = completeNext(s, R)!;
    const older = "2026-11-07T07:10:00+09:00"; // デモの朝（12月）より前の、本当の時刻
    const firstEvents = eventsForMission(s.morning, first);
    for (const x of s.morning.sorties) if (x.missionId === second) x.completedAt = older;
    for (const e of s.morning.scores) if (!firstEvents.includes(e)) e.at = older;
    expect(latestClear(s.morning, R)!.missionId).toBe(second);
  });

  it("見ている人の今朝の点（本人の記録）を付けられる", () => {
    const { s, missionId } = morningWithOneDone();
    const who = s.morning.sorties.find((x) => x.missionId === missionId)!.participantId;
    const c = summarizeClear(s.morning, R, missionId, { viewerId: who })!;
    expect(c.myPoints).toBeGreaterThanOrEqual(POINTS.mission_done);
    expect(summarizeClear(s.morning, R, missionId, { viewerId: "nobody" })!.myPoints).toBe(0);
  });

  it("まだ終わっていない家は null、内訳は理由の順", () => {
    const { s } = morningWithOneDone();
    const open = s.morning.missions.find((m) => m.status !== "done")!;
    expect(summarizeClear(s.morning, R, open.id)).toBeNull();
    const items = breakdown([
      { id: "a", teamId: "salvia", points: 5, reason: "early", at: "x" },
      { id: "b", teamId: "salvia", points: 10, reason: "mission_done", at: "x" },
      { id: "c", teamId: "salvia", points: 10, reason: "mission_done", at: "x" },
    ]);
    expect(items.map((i) => [i.reason, i.count, i.points])).toEqual([
      ["mission_done", 2, 20],
      ["early", 1, 5],
    ]);
  });
});
