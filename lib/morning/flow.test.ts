import { describe, expect, it } from "vitest";
import { mockPlan } from "../claude/commander";
import { teamTotals } from "./view";
import { applyPlan, commanderInput, completeNext, completeNextForDemo, emptyMorning, fillAnswers, putAnswer, rescueShort, ringRollcall } from "./flow";
import { TOWN_ROSTER as R } from "./roster";

describe("デモの朝の流れ", () => {
  it("予告 → 点呼 → 回答 → 作戦 → 完了 → 駆けつけ が通る", () => {
    const s = emptyMorning();
    expect(s.morning.rollcall.status).toBe("announced");

    ringRollcall(s);
    expect(s.morning.rollcall.status).toBe("open");

    fillAnswers(s, R);
    expect(s.answers.length).toBeGreaterThan(10);

    applyPlan(s, R, mockPlan(commanderInput(s, R)));
    expect(s.morning.rollcall.status).toBe("planned");
    expect(s.morning.missions.length).toBeGreaterThan(0);
    expect(s.messages.length).toBe(s.morning.sorties.length);

    const before = Object.values(teamTotals(s.morning)).reduce((a, b) => a + b, 0);
    const done = completeNext(s, R);
    expect(done).not.toBeNull();
    expect(s.morning.missions.find((m) => m.id === done)!.status).toBe("done");
    const after = Object.values(teamTotals(s.morning)).reduce((a, b) => a + b, 0);
    expect(after).toBeGreaterThan(before);

    // 完了を繰り返すと、そろっている家はなくなる
    while (completeNext(s, R)) {
      /* 続ける */
    }
    expect(s.morning.missions.some((m) => m.status === "assigned")).toBe(false);
    // 早朝ボーナスが付いている（最初の数軒は 7:30 まで）
    expect(s.morning.scores.some((e) => e.reason === "early")).toBe(true);
  });

  it("人手不足の家に、手の空いた人が駆けつけられる。自分の家を終えた人なら駆けつけボーナス対象", () => {
    const s = emptyMorning();
    ringRollcall(s);
    fillAnswers(s, R);
    applyPlan(s, R, mockPlan(commanderInput(s, R)));
    while (completeNext(s, R)) {
      /* 先に終わらせて手を空ける */
    }
    const shortIds = s.morning.missions.filter((m) => m.status === "short").map((m) => m.id);
    if (shortIds.length === 0) return; // この乱数では不足がない場合
    const helperId = rescueShort(s, R);
    expect(helperId).not.toBeNull();
    const sortie = s.morning.sorties.find((x) => x.participantId === helperId && x.status === "going")!;
    expect(shortIds).toContain(sortie.missionId);
    const finishedOwn = s.morning.sorties.some((x) => x.participantId === helperId && x.status === "done");
    expect(sortie.rescue).toBe(finishedOwn);
  });

  it("v1.20 の流れ（手伝う側は答えない）でも、駆けつけは「行く」を押した人の家へ別のチームから。4 で全部終わらせられる", () => {
    const s = emptyMorning();
    ringRollcall(s);
    // 頼む家の答えだけ（手伝う側の答えはない）
    for (const p of R.participants) if (p.role === "requester") putAnswer(s, p.id, "no", `${s.morning.rollcall.date}T06:31:00+09:00`);
    applyPlan(s, R, mockPlan(commanderInput(s, R)));
    const short = s.morning.missions.find((m) => m.status === "short")!;
    expect(short).toBeTruthy();
    // 本物の人（A）が「行く（10分でも）」で人手不足の家へ
    const a = R.participants.find((p) => p.role === "helper" && p.teamId)!;
    s.morning.sorties.push({ id: "sA", missionId: short.id, participantId: a.id, teamId: a.teamId!, subtaskIds: [], status: "going", rescue: false });
    const helperId = rescueShort(s, R);
    const joined = s.morning.sorties.find((x) => x.participantId === helperId && x.status === "going")!;
    expect(joined.missionId).toBe(short.id);
    expect(joined.teamId).not.toBe(a.teamId);
    // 撮影ステージの人など、動かさない人は選ばない
    const everyone = new Set(R.participants.map((p) => p.id));
    expect(rescueShort(s, R, undefined, everyone)).toBeNull();
    // 4: A の家は写真で終えるので後回し。ほかの家を全部終わらせられる
    const skip = (id: string) => id === short.id;
    for (let k = 0; k < 40 && completeNextForDemo(s, R, skip); k++) {
      if (s.morning.missions.filter((m) => m.status !== "done" && m.status !== "no_answer").every((m) => m.id === short.id)) break;
    }
    expect(s.morning.missions.find((m) => m.id === short.id)!.status).not.toBe("done");
    expect(s.morning.missions.filter((m) => m.id !== short.id && m.status !== "no_answer").every((m) => m.status === "done")).toBe(true);
  });

  it("4 を続けて押すと、終わった家の色（最初に来たチーム）が1色にかたよらない（11/8 本人「みんなオレンジになる」）", () => {
    const s = emptyMorning();
    ringRollcall(s);
    for (const p of R.participants) if (p.role === "requester") putAnswer(s, p.id, "no", `${s.morning.rollcall.date}T06:31:00+09:00`);
    applyPlan(s, R, mockPlan(commanderInput(s, R)));
    const first = new Set<string>();
    for (let k = 0; k < 6; k++) {
      const id = completeNextForDemo(s, R);
      if (!id) break;
      const t = s.morning.sorties.find((x) => x.missionId === id)?.teamId;
      if (t) first.add(t);
    }
    expect(first.size).toBeGreaterThan(1);
  });
});
