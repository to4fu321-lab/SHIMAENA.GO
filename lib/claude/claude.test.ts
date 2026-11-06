import { describe, expect, it } from "vitest";
import { TOWN } from "../town";
import type { HelperAnswer, RequesterAnswer } from "../types";
import { AnnounceSchema, mockAnnounce, mockSnowName, SNOW_NAME_MAX, SNOW_NAMES, snowNameHints, trimSnowName } from "./announce";
import { type CommanderInput, mockPlan, PlanSchema, REASON_MAX, sanitizePlan } from "./commander";
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

describe("前夜の予告と雪の名前（モック）", () => {
  it("形が正しく、名前は8字まで、文面に降雪量と名前が入る", () => {
    const a = mockAnnounce({ date: "2026-12-14", forecastCm: 12 });
    expect(AnnounceSchema.parse(a)).toEqual(a);
    expect(a.snowName.length).toBeLessThanOrEqual(SNOW_NAME_MAX);
    expect(a.text).toContain("12cm");
    expect(a.text).toContain(a.snowName);
    expect(a.text.startsWith("シマエナ隊長だしま〜！")).toBe(true); // 採点表 voice の名乗り
  });

  it("降雪量で名前が変わり、長すぎる名前は切り詰める", () => {
    expect(mockSnowName(3)).not.toBe(mockSnowName(12));
    expect(mockSnowName(12)).not.toBe(mockSnowName(30));
    // v1.30: 白いもので、毎朝ちがう名前。どれも10字まで、「◯◯雪の」の形は使わない
    for (const n of Object.values(SNOW_NAMES).flat()) {
      expect(n.length).toBeLessThanOrEqual(SNOW_NAME_MAX);
      expect(n).not.toMatch(/雪の/);
    }
    const week = new Set(["2026-12-14", "2026-12-15", "2026-12-16", "2026-12-17", "2026-12-18", "2026-12-19", "2026-12-20"].map((d) => mockSnowName(12, d)));
    expect(week.size).toBeGreaterThanOrEqual(4);
    expect(SNOW_NAMES.medium).toContain(mockSnowName(12, "2026-12-14"));
    expect(SNOW_NAMES.huge).toContain(mockSnowName(40, "2026-12-14"));
    const hints = snowNameHints(12, "2026-12-14");
    expect(hints).toHaveLength(6);
    expect(hints.slice(0, 4).every((h) => SNOW_NAMES.medium.includes(h))).toBe(true);
    expect(trimSnowName("『とてもながいなまえのゆきぼす』", 12)).toHaveLength(SNOW_NAME_MAX);
    expect(trimSnowName("", 12)).toBe(mockSnowName(12));
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

  it("家ごとに司令官の理由があり、30字以内で体調の話をしない", () => {
    for (const m of plan.missions) {
      expect(m.reason.length).toBeGreaterThan(0);
      expect(m.reason.length).toBeLessThanOrEqual(REASON_MAX);
      expect(m.reason).not.toMatch(/体調|病気|医|薬/);
    }
    expect(plan.missions.find((m) => m.status === "no_answer")!.reason).toContain("声かけ");
  });

  it("割り当てられた人全員に文面があり、時刻と家の番号が入っている", () => {
    const assigned = plan.missions.flatMap((m) => m.assignedHelperIds);
    expect(plan.messages.map((m) => m.participantId).sort()).toEqual([...assigned].sort());
    for (const m of plan.messages) expect(m.text).toMatch(/07:00、拠点\d/);
  });

  it("Claude の作戦に間違いがあっても点検で直る", () => {
    const broken = {
      missions: [
        {
          baseId: input.bases[0].baseId,
          importance: 9,
          requiredPeople: 2,
          assignedHelperIds: ["h1", "h1", "nobody", "h4"],
          status: "assigned" as const,
          reason: "とても長い理由を\n改行つきで何度も書いてしまった場合でも三十字に切り詰められるはずです",
        },
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
    expect(fixed.missions[0].reason).toHaveLength(REASON_MAX);
    expect(fixed.missions[0].reason).not.toContain("\n");
    expect(fixed.missions[1]).toMatchObject({ assignedHelperIds: ["h6"], status: "assigned" });
    expect(fixed.missions[1].reason.length).toBeGreaterThan(0); // 理由がなければ規則から補う
    expect(fixed.messages.map((m) => m.participantId)).toEqual(["h1"]);
  });
});
