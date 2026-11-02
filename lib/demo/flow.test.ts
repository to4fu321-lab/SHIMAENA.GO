import { describe, expect, it } from "vitest";
import { mockPlan } from "../claude/commander";
import { teamTotals } from "../morning";
import { applyPlan, commanderInput, completeNext, emptyMorning, fillAnswers, rescueShort, ringRollcall } from "./flow";

describe("デモの朝の流れ", () => {
  it("予告 → 点呼 → 回答 → 作戦 → 完了 → 駆けつけ が通る", () => {
    const s = emptyMorning();
    expect(s.morning.rollcall.status).toBe("announced");

    ringRollcall(s);
    expect(s.morning.rollcall.status).toBe("open");

    fillAnswers(s);
    expect(s.answers.length).toBeGreaterThan(10);

    applyPlan(s, mockPlan(commanderInput(s)));
    expect(s.morning.rollcall.status).toBe("planned");
    expect(s.morning.missions.length).toBeGreaterThan(0);
    expect(s.messages.length).toBe(s.morning.sorties.length);

    const before = Object.values(teamTotals(s.morning)).reduce((a, b) => a + b, 0);
    const done = completeNext(s);
    expect(done).not.toBeNull();
    expect(s.morning.missions.find((m) => m.id === done)!.status).toBe("done");
    const after = Object.values(teamTotals(s.morning)).reduce((a, b) => a + b, 0);
    expect(after).toBeGreaterThan(before);

    // 完了を繰り返すと、そろっている家はなくなる
    while (completeNext(s)) {
      /* 続ける */
    }
    expect(s.morning.missions.some((m) => m.status === "assigned")).toBe(false);
    // 早朝ボーナスが付いている（最初の数軒は 7:30 まで）
    expect(s.morning.scores.some((e) => e.reason === "early")).toBe(true);
  });

  it("人手不足の家に、手の空いた人が駆けつけられる。自分の家を終えた人なら駆けつけボーナス対象", () => {
    const s = emptyMorning();
    ringRollcall(s);
    fillAnswers(s);
    applyPlan(s, mockPlan(commanderInput(s)));
    while (completeNext(s)) {
      /* 先に終わらせて手を空ける */
    }
    const short = s.morning.missions.find((m) => m.status === "short");
    if (!short) return; // この乱数では不足がない場合
    const helperId = rescueShort(s);
    expect(helperId).not.toBeNull();
    const sortie = s.morning.sorties.find((x) => x.participantId === helperId && x.missionId === short.id)!;
    expect(sortie.status).toBe("going");
    expect(sortie.rescue).toBe(true);
  });
});
