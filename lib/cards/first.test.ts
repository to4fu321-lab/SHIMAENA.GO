import { describe, expect, it } from "vitest";
import { mockPlan } from "../claude/commander";
import { applyPlan, commanderInput, completeNext, emptyMorning, fillAnswers, ringRollcall } from "../morning/flow";
import { TOWN_ROSTER as R } from "../morning/roster";
import { memoryRepo } from "../repo";
import { issueCardsForMission, rerenderBacks } from "./issue";

describe("初出撃の歓迎（spec v1.1）", () => {
  it("最初のカードには「初出撃」の一行が入り、2枚目からは入らない。ありがとうで裏面を作り直しても残る", async () => {
    const s = emptyMorning({ snowName: "ぼた雪のドンブリ" });
    ringRollcall(s);
    fillAnswers(s, R, 7);
    applyPlan(s, R, mockPlan(commanderInput(s, R)));
    const first = completeNext(s, R)!;
    const mission = s.morning.missions.find((m) => m.id === first)!;
    const sorties = s.morning.sorties.filter((x) => x.missionId === first);

    const issued = await issueCardsForMission(s, R, mission, sorties);
    expect(issued.firstFlightIds.sort()).toEqual(sorties.map((x) => x.participantId).sort());
    for (const c of issued.cards) expect((await memoryRepo.getCard(c.id))!.backSvg).toContain("初出撃");

    // 同じ人にもう一度発行すると、もう初出撃ではない
    const again = await issueCardsForMission(s, R, mission, sorties);
    expect(again.firstFlightIds).toEqual([]);
    for (const c of again.cards) expect((await memoryRepo.getCard(c.id))!.backSvg).not.toContain("初出撃");

    // ありがとう点呼で裏面を作り直しても、最初のカードにはリボンが残り、2枚目には付かない
    await rerenderBacks(mission.id, { date: s.morning.rollcall.date, thanks: "助かりました。", subtasks: ["玄関前の通路（5分）"] });
    for (const c of issued.cards) {
      const back = (await memoryRepo.getCard(c.id))!.backSvg;
      expect(back).toContain("初出撃");
      expect(back).toContain("助かりました");
    }
    for (const c of again.cards) expect((await memoryRepo.getCard(c.id))!.backSvg).not.toContain("初出撃");
  });
});
