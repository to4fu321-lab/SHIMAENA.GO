import { describe, expect, it } from "vitest";
import { mockThanks, THANKS_CHOICES, THANKS_MAX, ThanksSchema, trimThanks } from "../claude/thanks";
import { MSG } from "../line/messages";
import type { LineMessage } from "../line/types";
import { actionsOf, textOf } from "../line/flex";
import { memoryRepo } from "../repo";
import { DEMO_DATE, fillAnswers } from "./flow";
import { announce, applyThanks, completeWithPhoto, plan, ring, sendThanks } from "./ops";
import { loadRoster } from "./roster";
import { loadMorning, saveMorning } from "./store";

// 吹き出しが分かれても読めるように、全部の文をつなげて調べる
const t = (m: LineMessage | LineMessage[]) => [m].flat().map(textOf).join("\n");

async function morningWithOneDone() {
  await announce({ date: DEMO_DATE, forecastCm: 12 });
  await ring();
  const s = await loadMorning();
  fillAnswers(s, await loadRoster(), 7);
  await saveMorning(s);
  await plan();
  const planned = await loadMorning();
  const going = planned.morning.sorties.find((x) => x.status === "going")!;
  const r = await completeWithPhoto(going.participantId, { bytes: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg" });
  expect(r.done).toBe(true);
  return { missionId: going.missionId, participantId: going.participantId };
}

describe("ありがとう点呼（spec v1.1）", () => {
  it("完了の通知に3つのボタンが付く", () => {
    const m = MSG.requesterDoneNotice(["田中"], "m-x").at(-1)!; // ボタンは最後の吹き出しに付く
    expect(actionsOf(m).map((a) => a.label)).toEqual(["ありがとう", "助かりました", "お茶どうぞ"]);
    expect(actionsOf(m).map((a) => (a as { data?: string }).data)).toEqual(["thanks:m-x=1", "thanks:m-x=2", "thanks:m-x=3"]);
    expect(MSG.requesterDoneNotice(["田中"]).some((x) => actionsOf(x).length > 0)).toBe(false);
  });

  it("一文は40字まで、名前を入れず、3択ごとに変わる", () => {
    const base = { completedAtJst: "07:25", memberCount: 2, teamNames: ["サルビア"], forecastCm: 12 };
    const a = mockThanks({ ...base, label: THANKS_CHOICES["1"] });
    const b = mockThanks({ ...base, label: THANKS_CHOICES["3"] });
    expect(a).not.toBe(b);
    expect(a).toContain("7時台");
    expect(a).toContain("2人");
    expect(a.length).toBeLessThanOrEqual(THANKS_MAX);
    expect(ThanksSchema.parse({ sentence: a })).toEqual({ sentence: a });
    expect(trimThanks("あ".repeat(100))).toHaveLength(THANKS_MAX);
  });

  it("3択を受け取ると、記録が残り、カードの裏面に一文が入る。点は増えない", async () => {
    const { missionId } = await morningWithOneDone();
    const before = (await loadMorning()).morning.scores.length;
    const cardsBefore = await memoryRepo.listCardsByMission(missionId);
    expect(cardsBefore.length).toBeGreaterThan(0);

    const r = await applyThanks(missionId, "2");
    expect(r.ok).toBe(true);
    expect(r.record).toMatchObject({ choice: "2", label: "助かりました" });
    expect(t(r.messages)).toContain("助かりました");

    const s = await loadMorning();
    expect(s.thanks?.[missionId]?.sentence).toBe(r.record!.sentence);
    expect(s.morning.scores.length).toBe(before);
    for (const c of cardsBefore) {
      const stored = await memoryRepo.getCard(c.id);
      expect(stored!.backSvg).toContain(r.record!.sentence.slice(0, 8));
    }
  });

  it("LINE のボタンは、その家の依頼者だけが押せる。終わっていない家や知らない人は断る", async () => {
    const { missionId } = await morningWithOneDone();
    const roster = await loadRoster();
    const s = await loadMorning();
    const base = roster.bases.find((b) => b.id === s.morning.missions.find((m) => m.id === missionId)!.baseId)!;
    const requester = roster.participants.find((p) => p.id === base.requesterId)!;
    await memoryRepo.upsertParticipant({ ...requester, lineUserId: "U-req" });
    const other = roster.participants.find((p) => p.role === "requester" && p.id !== requester.id)!;
    await memoryRepo.upsertParticipant({ ...other, lineUserId: "U-other" });

    expect(t((await sendThanks("U-nobody", `thanks:${missionId}=1`)))).toContain("登録がまだ");
    expect(t((await sendThanks("U-other", `thanks:${missionId}=1`)))).toContain("見つかりません");
    const open = s.morning.missions.find((m) => m.status !== "done")!;
    expect(t((await sendThanks("U-req", `thanks:${open.id}=1`)))).toContain("見つかりません");
    expect(t((await sendThanks("U-req", `thanks:${missionId}=1`)))).toContain("ありがとう");
    expect((await loadMorning()).thanks?.[missionId]?.label).toBe("ありがとう");
  });
});
