import { describe, expect, it } from "vitest";
import { MSG } from "../line/messages";
import type { TextMessage } from "../line/types";
import { memoryRepo } from "../repo";
import { parseCheer } from "./cheer";
import { DEMO_DATE, fillAnswers } from "./flow";
import { announce, applyCheer, completeWithPhoto, plan, ring, sendCheer } from "./ops";
import { loadRoster } from "./roster";
import { loadMorning, saveMorning } from "./store";

const t = (m: { type: string }) => (m as TextMessage).text;

async function morningWithOneDone() {
  await announce({ date: DEMO_DATE, forecastCm: 12 });
  await ring();
  const s = await loadMorning();
  fillAnswers(s, await loadRoster(), 7);
  await saveMorning(s);
  await plan();
  const going = (await loadMorning()).morning.sorties.find((x) => x.status === "going")!;
  const r = await completeWithPhoto(going.participantId, { bytes: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg" });
  expect(r.done).toBe(true);
  return going.missionId;
}

describe("家族の応援スタンプ（spec v1.2）", () => {
  it("家族への完了通知に3つのボタンが付く。データの読み取り", () => {
    const m = MSG.familyDone(["田中"], "m-x");
    expect(m.quickReply?.items.map((i) => i.action.label)).toEqual(["お疲れさま", "あったかくして", "遠くから拍手"]);
    expect(MSG.familyDone(["田中"]).quickReply).toBeUndefined();
    expect(parseCheer("cheer:m-x=2")).toEqual({ missionId: "m-x", choice: "2" });
    expect(parseCheer("cheer:m-x=9")).toBeNull();
    expect(parseCheer("thanks:m-x=1")).toBeNull();
  });

  it("応援は記録に残り、何度でも（家族が複数でも）送れる。点は増えない", async () => {
    const missionId = await morningWithOneDone();
    const before = (await loadMorning()).morning.scores.length;
    const r = await applyCheer(missionId, "1");
    expect(r.ok).toBe(true);
    expect(t(r.messages[0])).toContain("お疲れさま");
    await applyCheer(missionId, "3");
    const s = await loadMorning();
    expect(s.cheers?.[missionId]?.map((c) => c.label)).toEqual(["お疲れさま", "遠くから拍手"]);
    expect(s.morning.scores.length).toBe(before);
  });

  it("LINE のボタンは、その家に紐づいた家族だけが押せる", async () => {
    const missionId = await morningWithOneDone();
    const roster = await loadRoster();
    const s = await loadMorning();
    const base = roster.bases.find((b) => b.id === s.morning.missions.find((m) => m.id === missionId)!.baseId)!;
    await memoryRepo.addFamilyLink({ familyLineUserId: "U-family", requesterId: base.requesterId, linkCode: "111222" });

    expect(t((await sendCheer("U-stranger", `cheer:${missionId}=1`))[0])).toContain("見つかりません");
    expect(t((await sendCheer("U-family", `cheer:${missionId}=2`))[0])).toContain("あったかくして");
    const open = s.morning.missions.find((m) => m.status !== "done")!;
    expect(t((await sendCheer("U-family", `cheer:${open.id}=2`))[0])).toContain("見つかりません");
    expect((await loadMorning()).cheers?.[missionId]?.[0]?.label).toBe("あったかくして");
  });
});
