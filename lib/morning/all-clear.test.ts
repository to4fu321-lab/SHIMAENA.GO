import { describe, expect, it } from "vitest";
import { allClearLine, allClearMembers, allClearStats, allClearVoiceText, ALL_CLEAR_VOICE_HEAD } from "./all-clear";
import type { MorningState } from "./view";

function state(doneB: boolean): MorningState {
  const at = "2026-12-01T22:30:00.000Z";
  return {
    viewerId: "h1",
    rollcall: { date: "2026-12-02", forecastCm: 12, snowName: "のんびりオコジョ" },
    missions: [
      { id: "m1", baseId: "b1", status: "done", snowKg: 120.4 },
      { id: "m2", baseId: "b2", status: doneB ? "done" : "in_progress", snowKg: doneB ? 80 : undefined },
    ],
    sorties: [
      { missionId: "m1", participantId: "h1", teamId: "ezorisu", status: "done", completedAt: at, subtaskIds: [] },
      { missionId: "m1", participantId: "h2", teamId: "kitakitsune", status: "done", completedAt: at, subtaskIds: [] },
      { missionId: "m2", participantId: "h1", teamId: "ezorisu", status: doneB ? "done" : "going", completedAt: doneB ? at : undefined, subtaskIds: [] },
    ],
    scores: [],
  } as unknown as MorningState;
}

describe("全軒 完了！のお祝い", () => {
  it("まだ終わっていない朝は null", () => {
    expect(allClearStats(state(false))).toBeNull();
  });
  it("すべて終わったら、軒数・人数・チーム数・雪を数える", () => {
    const s = allClearStats(state(true))!;
    expect(s).toMatchObject({ houses: 2, people: 2, teams: 2, snowKg: 200, snowName: "のんびりオコジョ" });
    expect(s.at).toMatch(/^\d{1,2}:\d{2}$/);
    expect(allClearLine(s)).toBe("2人・2チームで、2軒すべてに灯りがともりました。");
  });
  it("知らせる相手は、雪かきを終えた人（同じ人は1回）", () => {
    expect(allClearMembers(state(true))).toEqual(["h1", "h2"]);
  });
  it("声は決まった一言から始まり、数字は画面と同じ", () => {
    const v = allClearVoiceText(allClearStats(state(true))!);
    expect(v.startsWith(ALL_CLEAR_VOICE_HEAD)).toBe(true);
    expect(v).toContain("2軒すべて");
    expect(v.length).toBeLessThanOrEqual(180);
  });
});
