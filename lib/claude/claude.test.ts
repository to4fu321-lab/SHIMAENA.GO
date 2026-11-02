import { describe, expect, it } from "vitest";
import { TOWN } from "../town";
import type { HelperAnswer, RequesterAnswer } from "../types";
import { type CommanderInput, mockPlan, PlanSchema, sanitizePlan } from "./commander";
import { judgeLevel, LevelResultSchema, mockLevel } from "./level";

const ANSWERS: (RequesterAnswer | "none")[] = ["no", "no", "together", "yes", "no", "none", "together", "no"];
const MINUTES: HelperAnswer[] = [30, 15, 15, 0, 60, 15, 60, 30, 15, 30, 0, 15];

function demoInput(): CommanderInput {
  const requesters = TOWN.participants.filter((p) => p.role === "requester");
  const helpers = TOWN.participants.filter((p) => p.role === "helper");
  return {
    date: "2026-12-14",
    forecastCm: 12,
    startTime: "07:00",
    bases: TOWN.bases.map((b, i) => {
      const r = requesters.find((p) => p.id === b.requesterId)!;
      return { baseId: b.id, number: b.number, level: r.level!, answer: ANSWERS[i], location: r.location, requesterName: r.nickname };
    }),
    helpers: helpers.map((h, i) => ({ id: h.id, nickname: h.nickname, teamId: h.teamId!, minutes: MINUTES[i], location: h.location })),
  };
}

describe("レベル判定（モック）", () => {
  it("形が正しく、採点表どおり", async () => {
    const r = mockLevel({ soloMinutes: 60, clearArea: "road" });
    expect(LevelResultSchema.parse(r)).toEqual(r);
    expect(r.level).toBe(3);
    expect(r.subtasks.map((t) => t.kind)).toEqual(expect.arrayContaining(["path", "sand", "garage", "road"]));
    expect(mockLevel({ soloMinutes: 15, clearArea: "entrance" }).level).toBe(1);
    expect(mockLevel({ soloMinutes: "unknown", clearArea: "entrance" }).level).toBe(2);
  });

  it("キーがなければモックが返る", async () => {
    if (process.env.ANTHROPIC_API_KEY) return;
    expect(await judgeLevel({ soloMinutes: 30, clearArea: "garage" })).toEqual(mockLevel({ soloMinutes: 30, clearArea: "garage" }));
  });
});

describe("司令官（モック）", () => {
  const input = demoInput();
  const plan = mockPlan(input);

  it("形が正しい", () => {
    expect(PlanSchema.parse(plan)).toEqual(plan);
  });

  it("「はい」の家はミッションにならず、それ以外は全部ミッションになる", () => {
    const ids = plan.missions.map((m) => m.baseId);
    expect(ids).not.toContain(input.bases[3].baseId);
    expect(ids).toHaveLength(7);
  });

  it("重要度の高い順に並ぶ", () => {
    const imp = plan.missions.map((m) => m.importance);
    expect(imp).toEqual([...imp].sort((a, b) => b - a));
  });

  it("動ける分数が0の人は割り当てず、1人は1軒だけ", () => {
    const all = plan.missions.flatMap((m) => m.assignedHelperIds);
    expect(new Set(all).size).toBe(all.length);
    expect(all).not.toContain("h4");
    expect(all).not.toContain("h11");
  });

  it("返事なしの家は no_answer、人数がそろった家は assigned、足りない家は short", () => {
    const byBase = new Map(plan.missions.map((m) => [m.baseId, m]));
    expect(byBase.get(input.bases[5].baseId)!.status).toBe("no_answer");
    for (const m of plan.missions) {
      if (m.status === "assigned") expect(m.assignedHelperIds.length).toBeGreaterThanOrEqual(m.requiredPeople);
      if (m.status === "short") expect(m.assignedHelperIds.length).toBeLessThan(m.requiredPeople);
    }
  });

  it("割り当てられた人全員に文面があり、時刻と家の番号が入っている", () => {
    const assigned = plan.missions.flatMap((m) => m.assignedHelperIds);
    expect(plan.messages.map((m) => m.participantId).sort()).toEqual([...assigned].sort());
    for (const m of plan.messages) expect(m.text).toMatch(/07:00、拠点\d/);
  });

  it("Claude の作戦に間違いがあっても点検で直る", () => {
    const broken = {
      missions: [
        { baseId: input.bases[0].baseId, importance: 9, requiredPeople: 2, assignedHelperIds: ["h1", "h1", "nobody", "h4"], status: "assigned" as const },
        { baseId: input.bases[0].baseId, importance: 9, requiredPeople: 2, assignedHelperIds: ["h2"], status: "assigned" as const },
        { baseId: "base-nope", importance: 1, requiredPeople: 1, assignedHelperIds: ["h3"], status: "assigned" as const },
        { baseId: input.bases[3].baseId, importance: 1, requiredPeople: 1, assignedHelperIds: ["h5"], status: "assigned" as const },
        { baseId: input.bases[1].baseId, importance: 8, requiredPeople: 1, assignedHelperIds: ["h1", "h6"], status: "short" as const },
      ],
      messages: [{ participantId: "h1", text: "a" }, { participantId: "h3", text: "b" }],
      briefing: "まとめ",
    };
    const fixed = sanitizePlan(broken, input);
    expect(fixed.missions.map((m) => m.baseId)).toEqual([input.bases[0].baseId, input.bases[1].baseId]);
    expect(fixed.missions[0]).toMatchObject({ assignedHelperIds: ["h1"], status: "short" });
    expect(fixed.missions[1]).toMatchObject({ assignedHelperIds: ["h6"], status: "assigned" });
    expect(fixed.messages.map((m) => m.participantId)).toEqual(["h1"]);
  });
});
