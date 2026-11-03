import { describe, expect, it } from "vitest";
import { DEMO_DATE, emptyMorning } from "./morning/flow";
import { TOWN_ROSTER } from "./morning/roster";
import { destinationsFor, mapsUrl } from "./nav";

describe("道順", () => {
  it("Google マップの徒歩の道順 URL を作る", () => {
    const u = mapsUrl([43.04, 141.37], [43.041, 141.371]);
    expect(u).toContain("destination=43.040000%2C141.370000");
    expect(u).toContain("origin=43.041000%2C141.371000");
    expect(u).toContain("travelmode=walking");
  });
  it("向かっている本人にだけ、家の正確な場所と道順を返す", () => {
    const s = emptyMorning({ date: DEMO_DATE });
    const base = TOWN_ROSTER.bases[0];
    s.morning.missions.push({ id: "m1", rollcallId: s.morning.rollcall.id, baseId: base.id, importance: 5, requiredPeople: 1, subtasks: [], status: "assigned", startAt: "" });
    s.morning.sorties.push({ id: "s1", missionId: "m1", participantId: "h1", teamId: "salvia", subtaskIds: [], status: "going", rescue: false });
    const mine = destinationsFor(s, TOWN_ROSTER, "h1");
    expect(mine).toHaveLength(1);
    expect(mine[0].baseNumber).toBe(base.number);
    expect(mine[0].location).toEqual(TOWN_ROSTER.participants.find((p) => p.id === base.requesterId)!.location);
    expect(mine[0].mapsUrl).toContain("travelmode=walking");
    expect(destinationsFor(s, TOWN_ROSTER, "h2")).toEqual([]);
    s.morning.sorties[0].status = "done";
    expect(destinationsFor(s, TOWN_ROSTER, "h1")).toEqual([]);
  });
});
