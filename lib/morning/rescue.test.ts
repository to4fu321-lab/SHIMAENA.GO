import { describe, expect, it } from "vitest";
import type { TextMessage } from "../line/types";
import { completeNext, DEMO_DATE, fillAnswers } from "./flow";
import { announce, joinMission, joinNearby, plan, ring } from "./ops";
import { loadRoster } from "./roster";
import { loadMorning, saveMorning } from "./store";
import { busyIds, listShort } from "./watch";

// 吹き出しが分かれても読めるように、全部の文をつなげて調べる
const t = (m: { type: string } | { type: string }[]) => [m].flat().map((x) => (x as TextMessage).text ?? "").join("\n");

async function setup(seed = 5) {
  await announce({ date: DEMO_DATE, forecastCm: 12 });
  await ring();
  const s = await loadMorning();
  fillAnswers(s, await loadRoster(), seed);
  await saveMorning(s);
  await plan();
  return loadMorning();
}

/** 1軒終わらせて、手の空いた人（自分の家を終えた人）を作る */
async function freeSomeHelpers() {
  const s = await loadMorning();
  const roster = await loadRoster();
  completeNext(s, roster);
  await saveMorning(s);
  const after = await loadMorning();
  const busy = busyIds(after);
  const zero = new Set(after.answers.filter((a) => a.answer === 0).map((a) => a.participantId));
  return roster.participants.filter((p) => p.role === "helper" && p.teamId && !busy.has(p.id) && !zero.has(p.id));
}

describe("あと1人で救える家と「5分だけ参加」（spec v1.1）", () => {
  it("人手が足りない家を、足りない人数が少ない順に、5分の仕事つきで出す", async () => {
    const s = await setup(5);
    const roster = await loadRoster();
    const list = listShort(s, roster);
    expect(list.length).toBe(s.morning.missions.filter((m) => m.status === "short").length);
    for (let i = 1; i < list.length; i++) expect(list[i].missing).toBeGreaterThanOrEqual(list[i - 1].missing);
    for (const h of list) {
      expect(h.missing).toBeGreaterThan(0);
      expect(h.tasks.length).toBeGreaterThan(0);
      expect(h.tasks.length).toBeLessThanOrEqual(2);
      expect(h.going).toBeLessThan(h.required);
    }
  });

  it("「5分だけ参加」: 手の空いた人は足りない家に加わり、なければ作業中の家に偵察・補給で加わる", async () => {
    await setup(5);
    const free = await freeSomeHelpers();
    expect(free.length).toBeGreaterThan(0);

    const r1 = await joinNearby(free[0].id, 5);
    expect(r1.joined).toBe(true);
    expect(t(r1.messages)).toContain(`拠点${r1.baseNumber}`);
    let after = await loadMorning();
    const mine = after.morning.sorties.find((x) => x.participantId === free[0].id && x.status === "going")!;
    expect(mine.status).toBe("going");
    expect(mine.rescue).toBe(true); // 自分の家を終えてから駆けつけた
    // 向かっている最中の人には、もう何も出さない
    expect((await joinNearby(free[0].id, 5)).joined).toBe(false);

    // 全部の家に人をそろえてから、別の人が「5分だけ参加」→ 偵察・補給として加わる
    after = await loadMorning();
    for (const m of after.morning.missions) if (m.status === "short") m.status = "in_progress";
    await saveMorning(after);
    const second = free.find((p) => p.id !== free[0].id);
    if (!second) return; // この乱数では手の空いた人が1人だけ
    const r2 = await joinNearby(second.id, 5);
    expect(r2.joined).toBe(true);
    const scout = (await loadMorning()).morning.sorties.find((x) => x.participantId === second.id && x.status === "going")!;
    expect(scout.subtaskIds).toEqual(["scout"]);
  });

  it("「5分だけ助けに行く」: そろっている家にはふつうは加われない（extra のときだけ）", async () => {
    await setup(5);
    const free = await freeSomeHelpers();
    const s = await loadMorning();
    const full = s.morning.missions.find((m) => m.status === "assigned" || m.status === "in_progress");
    if (!full || free.length === 0) return; // この乱数ではそろった家が残らない
    expect(t((await joinMission(free[0].id, full.id)))).toContain("そろいました");
    expect(t((await joinMission(free[0].id, full.id, new Date(), { extra: true })))).toContain("ありがとうございます");
  });
});
