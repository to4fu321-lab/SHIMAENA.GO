import { describe, expect, it } from "vitest";
import type { Mission, Sortie } from "../types";
import { activeHelpers, reopenDone } from "./rounds";

const mission = (id: string, baseId: string, status: Mission["status"], round?: number): Mission => ({
  id, rollcallId: "rc", baseId, importance: 1, requiredPeople: 2, subtasks: [], status, startAt: "2026-12-14T07:00:00+09:00", ...(round ? { round } : {}),
});
const sortie = (missionId: string, participantId: string, status: Sortie["status"], completedAt?: string): Sortie => ({
  id: `${missionId}-${participantId}`, missionId, participantId, teamId: "salvia", subtaskIds: [], status, rescue: false, ...(completedAt ? { completedAt } : {}),
});

describe("1日に何回でも（v1.8）", () => {
  it("いま雪かき中の人数は、向かっている人を1人ずつ数える", () => {
    const st = { missions: [], sorties: [sortie("m1", "a", "going"), sortie("m2", "a", "going"), sortie("m1", "b", "going"), sortie("m1", "c", "done")] };
    expect(activeHelpers(st)).toBe(2);
  });

  it("降り続く日は、終わった家だけ2回目が開く（前の記録は残る）", () => {
    const st = {
      missions: [mission("m1", "b1", "done"), mission("m2", "b2", "short")],
      sorties: [sortie("m1", "a", "done", "2026-12-14T07:20:00+09:00")],
    };
    const added = reopenDone(st, "2026-12-14T11:30:00+09:00", () => true);
    expect(added.map((m) => [m.id, m.round, m.status])).toEqual([["m1-r2", 2, "short"]]);
    expect(st.missions.find((m) => m.id === "m1")?.status).toBe("done");
    // まだ開いている回があるので、もう一度呼んでも増えない
    expect(reopenDone(st, "2026-12-14T12:00:00+09:00", () => true)).toHaveLength(0);
  });

  it("雪がやんでいれば開かない。3回目まで", () => {
    const st = { missions: [mission("m1-r3", "b1", "done", 3)], sorties: [sortie("m1-r3", "a", "done", "2026-12-14T16:00:00+09:00")] };
    expect(reopenDone(st, "2026-12-14T17:00:00+09:00", () => true)).toHaveLength(0);
    const st2 = { missions: [mission("m1", "b1", "done")], sorties: [sortie("m1", "a", "done", "2026-12-14T07:00:00+09:00")] };
    expect(reopenDone(st2, "2026-12-14T11:30:00+09:00", () => false)).toHaveLength(0);
  });
});

import { mockPlan } from "../claude/commander";
import { applyPlan, commanderInput, emptyMorning, putAnswer, ringRollcall } from "./flow";
import { TOWN_ROSTER as R } from "./roster";

describe("点呼の「いつ手伝えそう？」（v1.8）", () => {
  it("6:40 の作戦に入るのは朝の人だけ。お昼・夕方の人は割り当てない（あとでお知らせ）", () => {
    const s = emptyMorning();
    ringRollcall(s);
    const helpers = R.participants.filter((p) => p.role === "helper" && p.teamId);
    const [amP, noonP, pmP] = helpers;
    putAnswer(s, amP.id, 20, "2026-12-14T06:31:00+09:00", "am");
    putAnswer(s, noonP.id, 20, "2026-12-14T06:31:00+09:00", "noon");
    putAnswer(s, pmP.id, 20, "2026-12-14T06:31:00+09:00", "pm");
    const input = commanderInput(s, R);
    const mins = (id: string) => input.helpers.find((h) => h.id === id)?.minutes;
    expect(mins(amP.id)).toBe(20);
    expect(mins(noonP.id)).toBe(0);
    expect(mins(pmP.id)).toBe(0);
    applyPlan(s, R, mockPlan(input));
    const assigned = new Set(s.morning.sorties.map((x) => x.participantId));
    expect(assigned.has(noonP.id) || assigned.has(pmP.id)).toBe(false);
    expect(s.answers.find((a) => a.participantId === noonP.id)?.when).toBe("noon");
  });
});
