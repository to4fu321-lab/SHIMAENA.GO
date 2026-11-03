import { beforeEach, describe, expect, it } from "vitest";
import { soloCells } from "../cells";
import { DEMO_DATE, fillAnswers } from "../morning/flow";
import { announce, completeManually, plan, ring } from "../morning/ops";
import { loadRoster } from "../morning/roster";
import { loadMorning, saveMorning } from "../morning/store";
import { teamTotals } from "../morning/view";
import { memoryRepo } from "../repo";
import { totalFeathers } from "./feathers";
import { soloStatus } from "./ops";

describe("家の完了にも羽（spec v1.3）", () => {
  beforeEach(() => {
    for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive"]) delete (globalThis as Record<string, unknown>)[k];
  });

  it("来た人それぞれに help_house 10羽、チーム得点は得点表どおりのまま、足あとは拠点のマスに", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    const s0 = await loadMorning();
    fillAnswers(s0, await loadRoster(), 7);
    await saveMorning(s0);
    await plan();
    const going = (await loadMorning()).morning.sorties.find((x) => x.status === "going")!;
    const members = (await loadMorning()).morning.sorties.filter((x) => x.missionId === going.missionId);

    const r = await completeManually(going.participantId);
    expect(r.done).toBe(true);
    const s = await loadMorning();
    const totals = teamTotals(s.morning);
    const scored = s.morning.scores.reduce((a, e) => a + e.points, 0);
    expect(Object.values(totals).reduce((a, b) => a + b, 0)).toBe(scored); // 羽は得点に混ざっていない

    for (const m of members) {
      const logs = await memoryRepo.listSoloLogsByParticipant(m.participantId);
      const house = logs.filter((l) => l.kind === "help_house");
      expect(house).toHaveLength(1);
      expect(house[0].missionId).toBe(going.missionId);
      expect(house[0].date).toBe(DEMO_DATE); // デモの朝の日付（アプリの今日）
      expect(totalFeathers(logs)).toBe(13); // 10 + 初回出動 3
      const st = await soloStatus(m.participantId, new Date());
      expect(st.todayFeathers).toBe(13);
      expect(st.streak).toBe(1);
    }
    const today = DEMO_DATE;
    const cells = soloCells(await memoryRepo.listSoloLogsBetween(today, today));
    expect(cells).toHaveLength(1);
    expect(cells[0].count).toBe(members.length);
    expect(cells[0].key).toMatch(/^-?\d+,-?\d+$/); // マスのキーだけ（緯度経度ではない）
  });
});
