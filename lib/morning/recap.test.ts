import { describe, expect, it } from "vitest";
import { mockPlan } from "../claude/commander";
import { mockRecap, RecapSchema } from "../claude/recap";
import { applyPlan, commanderInput, completeNext, emptyMorning, fillAnswers, rescueShort, ringRollcall } from "./flow";
import { buildRecapInput } from "./recap";
import { TOWN_ROSTER as R } from "./roster";

function morning() {
  const s = emptyMorning({ snowName: "ぼた雪のドンブリ" });
  ringRollcall(s);
  fillAnswers(s, R, 7);
  applyPlan(s, R, mockPlan(commanderInput(s, R)));
  return s;
}

describe("今朝の実況（spec v1.1 9-6）", () => {
  it("材料は本当の集計から作る", () => {
    const s = morning();
    completeNext(s, R);
    const i = buildRecapInput(s, R);
    expect(i.snowName).toBe("ぼた雪のドンブリ");
    expect(i.housesTotal).toBe(s.morning.missions.filter((m) => m.status !== "no_answer").length);
    expect(i.housesDone).toBe(1);
    expect(i.movers).toBe(new Set(s.morning.sorties.map((x) => x.participantId)).size);
    expect(i.teamsOut).toBeGreaterThanOrEqual(1);
    expect(i.firstDoneAt).toMatch(/^\d\d:\d\d$/);
    expect(i.allDone).toBe(false);
  });

  it("全軒終わると討伐の実況になり、定型文は渡した数字だけを使う", () => {
    const s = morning();
    for (let k = 0; k < 60 && (completeNext(s, R) || rescueShort(s, R)); k++) {
      /* 全部終わらせる */
    }
    const i = buildRecapInput(s, R);
    expect(i.allDone).toBe(true);
    const r = mockRecap(i);
    expect(RecapSchema.parse(r)).toEqual(r);
    expect(r.text).toContain("討伐");
    expect(r.text.startsWith("エナガ隊長だしま〜！")).toBe(true);
    expect(r.text).toContain(`${i.housesDone}軒`);
    expect(r.text).toContain(`${i.movers}人`);
    expect(r.text).toContain("ぼた雪のドンブリ");
    expect(r.text).not.toMatch(/体調|医/);
    // 文は3〜5つ（名乗りは数えない）
    const sentences = r.text.replace("エナガ隊長だしま〜！", "").split("。").filter(Boolean).length;
    expect(sentences).toBeGreaterThanOrEqual(3);
    expect(sentences).toBeLessThanOrEqual(5);
  });

  it("まだ1軒も終わっていなくても書ける", () => {
    const i = buildRecapInput(morning(), R);
    expect(mockRecap(i).text).toContain("まだ最初の家は終わっていません");
  });
});
