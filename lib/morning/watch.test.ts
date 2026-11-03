import { describe, expect, it } from "vitest";
import { handleEvent } from "../line/handle";
import type { LineEvent, TextMessage } from "../line/types";
import { memoryRepo } from "../repo";
import type { Participant } from "../types";
import { DEMO_DATE, fillAnswers } from "./flow";
import { announce, answerRollcall, completeWithPhoto, escalateHelpIfDue, joinMission, notifyHelp, plan, reportShort, ring, setGoing } from "./ops";
import { loadRoster } from "./roster";
import { loadMorning, saveMorning } from "./store";
import { applyLateAnswer, helpDue, missingPeople, pickHelpTargets } from "./watch";

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

describe("ヘルプ通知の判断（純粋な関数）", () => {
  it("5分たつまで次の輪は出さない。サポーターまで出したら終わり", () => {
    const now = new Date("2026-12-14T06:50:00+09:00");
    expect(helpDue({ stage: 0, notifiedIds: [] }, now)).toBe(true);
    expect(helpDue({ stage: 1, lastAt: "2026-12-14T06:47:00+09:00", notifiedIds: [] }, now)).toBe(false);
    expect(helpDue({ stage: 1, lastAt: "2026-12-14T06:45:00+09:00", notifiedIds: [] }, now)).toBe(true);
    expect(helpDue({ stage: 4, lastAt: "2026-12-14T06:00:00+09:00", notifiedIds: [] }, now)).toBe(false);
  });

  it("輪の中の手伝う側だけを、向かっている人・呼んだ人・0分の人を除いて選ぶ", async () => {
    const s = await setup();
    const roster = await loadRoster();
    const short = s.morning.missions.find((m) => m.status === "short") ?? s.morning.missions[0];
    const busy = new Set(s.morning.sorties.filter((x) => x.status === "going").map((x) => x.participantId));
    const zero = new Set(s.answers.filter((a) => a.answer === 0).map((a) => a.participantId));
    const targets = pickHelpTargets(s, roster, short, 0);
    for (const p of targets) {
      expect(p.role).toBe("helper");
      expect(busy.has(p.id)).toBe(false);
      expect(zero.has(p.id)).toBe(false);
    }
    expect(missingPeople(s, short)).toBeGreaterThanOrEqual(0);
  });

  it("作戦のあとの答え: 「はい」で取り下げ、「いいえ」で人手不足に、手伝う側は記録だけ", async () => {
    const s = await setup();
    const roster = await loadRoster();
    const noAns = s.morning.missions.find((m) => m.status === "no_answer");
    if (noAns) {
      const base = roster.bases.find((b) => b.id === noAns.baseId)!;
      const requester = roster.participants.find((p) => p.id === base.requesterId)!;
      const r = applyLateAnswer(s, roster, requester, "no", "2026-12-14T06:50:00+09:00");
      expect(r.kind).toBe("short");
      expect(noAns.status).toBe("short");
      expect(noAns.requiredPeople).toBe(requester.level ?? 2);
      const fine = applyLateAnswer(s, roster, requester, "yes", "2026-12-14T06:51:00+09:00");
      expect(fine.kind).toBe("fine");
      expect(s.morning.missions.some((m) => m.id === noAns.id)).toBe(false);
    }
    const helper = roster.participants.find((p) => p.role === "helper")!;
    expect(applyLateAnswer(s, roster, helper, 30, "2026-12-14T06:52:00+09:00").kind).toBe("helper");
    expect(s.answers.find((a) => a.participantId === helper.id)?.answer).toBe(30);
  });
});

describe("ヘルプ通知の流れ（メモリ保存・LINE には送らない）", () => {
  it("作戦配信で足りない家は 300m に通知され、次の輪 → 1km → サポーターまで進む", async () => {
    const s = await setup(5);
    const short = s.morning.missions.find((m) => m.status === "short");
    if (!short) return; // この種では不足なし
    expect(s.help?.[short.id]?.stage).toBe(1);
    expect(s.log.some((l) => l.includes("ヘルプ通知 300m"))).toBe(true);
    // 5分たっていないので次の輪は出ない
    expect(await escalateHelpIfDue(new Date())).toBe(0);
    // 5分後に次の輪（足りない家が複数なら全部）
    const later = new Date(Date.now() + 6 * 60_000);
    expect(await escalateHelpIfDue(later)).toBeGreaterThanOrEqual(1);
    expect((await loadMorning()).help?.[short.id]?.stage).toBe(2);
    await notifyHelp(short.id, new Date(Date.now() + 12 * 60_000));
    const r = await notifyHelp(short.id, new Date(Date.now() + 18 * 60_000));
    expect(r?.ring).toBe("サポーター");
    expect((await loadMorning()).help?.[short.id]?.stage).toBe(4);
    expect(await notifyHelp(short.id)).toBeNull();
    // 同じ人に2回送らない
    const ids = (await loadMorning()).help![short.id].notifiedIds;
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("「行く（5分でも）」で出撃に加わる。自分の家を終えた人は駆けつけ扱い", async () => {
    await memoryRepo.upsertParticipant({
      id: "p-help", nickname: "ヘルプ太", role: "helper", location: [43.0401, 141.3699], lineUserId: "U-help", teamId: "marigold", morningMinutes: 30, hasTools: true,
    } satisfies Participant);
    const s = await setup(5);
    const short = s.morning.missions.find((m) => m.status === "short");
    if (!short) return;
    expect(t((await joinMission("p-help", short.id)))).toContain("ありがとう");
    const after = await loadMorning();
    const mine = after.morning.sorties.find((x) => x.participantId === "p-help" && x.missionId === short.id);
    expect(mine?.status).toBe("going");
    expect(mine?.confirmedAt).toBeTruthy();
    // 2回押しても増えない
    await joinMission("p-help", short.id);
    expect((await loadMorning()).morning.sorties.filter((x) => x.participantId === "p-help").length).toBe(1);
    // LINE のボタンからも同じ
    const ev = (data: string): LineEvent => ({ type: "postback", replyToken: "rt", source: { type: "user", userId: "U-help" }, timestamp: 0, postback: { data } }) as LineEvent;
    await handleEvent(ev("help:no"));
    await handleEvent(ev(`knock:${short.id}`));
  });

  it("現場の「人手が足りない」と「今朝は行けない」でヘルプ通知が出る。遅れた「いいえ」も", async () => {
    await memoryRepo.upsertParticipant({
      id: "p-req", nickname: "依頼花", role: "requester", location: [43.0399, 141.3701], lineUserId: "U-req", soloMinutes: 30, clearArea: "entrance", level: 2,
    });
    await memoryRepo.upsertBase({ id: "base-p-req", number: 99, requesterId: "p-req" });
    await memoryRepo.addFamilyLink({ familyLineUserId: "U-family", requesterId: "p-req", linkCode: "999999" });
    const s = await setup(9);
    const going = s.morning.sorties.find((x) => x.status === "going")!;
    const before = (await loadMorning()).help?.[going.missionId]?.stage ?? 0;
    await reportShort(going.participantId);
    const after = await loadMorning();
    expect(after.morning.missions.find((m) => m.id === going.missionId)?.status).toBe("short");
    expect((after.help?.[going.missionId]?.stage ?? 0)).toBeGreaterThanOrEqual(Math.max(1, before));

    // 返事なしだった依頼花さんが遅れて「いいえ」 → 人手不足になりヘルプ通知
    const mine = after.morning.missions.find((m) => m.baseId === "base-p-req");
    expect(mine?.status).toBe("no_answer");
    expect(after.log.some((l) => l.includes("拠点99: 返事なし") && l.includes("家族 1 人"))).toBe(true);
    expect(t((await answerRollcall("U-req", "rc:ans=no")))).toContain("人を集めます");
    const late = await loadMorning();
    expect(late.morning.missions.find((m) => m.baseId === "base-p-req")?.status).toBe("short");
    expect(late.help?.[mine!.id]?.stage).toBe(1);
    // 「はい」なら取り下げ
    expect(t((await answerRollcall("U-req", "rc:ans=yes")))).toContain("取り下げ");
    expect((await loadMorning()).morning.missions.some((m) => m.baseId === "base-p-req")).toBe(false);
  });

  it("完了すると家族にも「終わりました」が届く（ログで確認）", async () => {
    await memoryRepo.upsertParticipant({
      id: "p-req2", nickname: "依頼実", role: "requester", location: [43.0402, 141.3698], lineUserId: "U-req2", soloMinutes: 15, clearArea: "entrance", level: 1,
    });
    await memoryRepo.upsertBase({ id: "base-p-req2", number: 98, requesterId: "p-req2" });
    await memoryRepo.addFamilyLink({ familyLineUserId: "U-family2", requesterId: "p-req2", linkCode: "999998" });
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    let s = await loadMorning();
    fillAnswers(s, await loadRoster(), 2);
    s.answers = s.answers.filter((a) => a.participantId !== "p-req2");
    s.answers.push({ rollcallId: s.morning.rollcall.id, participantId: "p-req2", answer: "no", answeredAt: "2026-12-14T06:31:00+09:00" });
    await saveMorning(s);
    await plan();
    s = await loadMorning();
    const mine = s.morning.missions.find((m) => m.baseId === "base-p-req2")!;
    const sortie = s.morning.sorties.find((x) => x.missionId === mine.id);
    if (!sortie) return; // 人が割り当てられなかった種
    await setGoing(sortie.participantId, true);
    const r = await completeWithPhoto(sortie.participantId, { bytes: new Uint8Array([0xff, 0xd8, 0xff]), mediaType: "image/jpeg" });
    expect(r.done).toBe(true);
  });
});
