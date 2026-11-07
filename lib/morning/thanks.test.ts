import { describe, expect, it } from "vitest";
import { mockThanks, THANKS_CHOICES, THANKS_MAX, ThanksSchema, trimThanks } from "../claude/thanks";
import { MSG } from "../line/messages";
import type { LineMessage } from "../line/types";
import { actionsOf, textOf } from "../line/flex";
import { memoryRepo } from "../repo";
import { DEMO_DATE, fillAnswers } from "./flow";
import { announce, applyThanks, applyVoiceThanks, completeWithPhoto, familyVoiceRequester, plan, ring, sendThanks, voiceThanksTarget } from "./ops";
import { canListen, familyVoiceId, findThanksVoice, readThanksVoice, resetThanksVoices, voiceFromName } from "../thanks/voice";
import { repo } from "../repo";
import { thanksSentence } from "../claude/thanks";
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
  delete (globalThis as Record<string, unknown>).__shimaenaPhotoSeen; // 朝ごとに別の写真として扱う（同じ写真の使い回しの判定を消す）
  const r = await completeWithPhoto(going.participantId, { bytes: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg" });
  expect(r.done).toBe(true);
  return { missionId: going.missionId, participantId: going.participantId };
}

describe("ありがとう点呼（spec v1.1）", () => {
  it("完了の通知に3つのボタンが付く", () => {
    const all = MSG.requesterDoneNotice(["田中"], "m-x");
    const m = all.find((x) => actionsOf(x).length === 3)!; // 3択の吹き出し
    // 最後の吹き出しは「🎤 声でありがとう」（v1.29）
    expect(actionsOf(all.at(-1)!).map((a) => a.label)).toEqual(["🎤 声でありがとう"]);
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

describe("ありがとうは声で（spec v1.29）", () => {
  const audio = { bytes: new Uint8Array([26, 69, 223, 163, 1, 2, 3]), mime: "audio/webm;codecs=opus", seconds: 8 };

  it("3択は AI で書き直さず、押したことばをそのまま「」に入れる", async () => {
    const base = { completedAtJst: "07:25", memberCount: 2, teamNames: ["サルビア"], forecastCm: 12 };
    expect(await thanksSentence({ ...base, label: "お茶どうぞ" })).toBe("「お茶どうぞ」");
  });

  it("家の人の声を保存すると、手伝った人に「▶ 声を聞く」が届き、家の人と手伝った人だけが聞ける", async () => {
    resetThanksVoices();
    const { missionId, participantId } = await morningWithOneDone();
    const roster = await loadRoster();
    const s = await loadMorning();
    const base = roster.bases.find((b) => b.id === s.morning.missions.find((m) => m.id === missionId)!.baseId)!;
    const target = await voiceThanksTarget(missionId, base.requesterId);
    expect(target?.helperIds).toContain(participantId);

    const r = await applyVoiceThanks(missionId, base.requesterId, audio);
    expect(r.ok).toBe(true);
    const v = await findThanksVoice(missionId);
    expect(v).toMatchObject({ requesterId: base.requesterId, seconds: 8 });
    expect(canListen(v!, participantId)).toBe(true);
    expect(canListen(v!, base.requesterId)).toBe(true);
    const stranger = roster.participants.find((p) => p.id !== base.requesterId && !v!.helperIds.includes(p.id))!;
    expect(canListen(v!, stranger.id)).toBe(false);
    expect(await readThanksVoice(missionId, stranger.id)).toBeUndefined();
    expect((await readThanksVoice(missionId, participantId))?.audio).toEqual(audio.bytes);
    expect((await loadMorning()).thanksVoice?.[missionId]?.seconds).toBe(8);
    expect(t(MSG.voiceToHelper("田中", 3, missionId))).toContain("声のありがとう");
  });

  it("ほかの家の人・音でないもの・空の録音・7日より古い声は受け付けない", async () => {
    resetThanksVoices();
    const { missionId } = await morningWithOneDone();
    const roster = await loadRoster();
    const s = await loadMorning();
    const base = roster.bases.find((b) => b.id === s.morning.missions.find((m) => m.id === missionId)!.baseId)!;
    const other = roster.participants.find((p) => p.role === "requester" && p.id !== base.requesterId)!;
    expect((await applyVoiceThanks(missionId, other.id, audio)).ok).toBe(false);
    expect((await applyVoiceThanks(missionId, base.requesterId, { ...audio, mime: "text/html" })).ok).toBe(false);
    expect((await applyVoiceThanks(missionId, base.requesterId, { ...audio, bytes: new Uint8Array() })).ok).toBe(false);
    const old = new Date(Date.now() - 8 * 86400_000);
    expect((await applyVoiceThanks(missionId, base.requesterId, audio, old)).ok).toBe(true);
    expect(await findThanksVoice(missionId)).toBeUndefined();
  });

  it("離れて暮らす家族の声は別の枠に入り、家の人の声を上書きしない。紐づいた家族だけが吹き込める（11/7）", async () => {
    resetThanksVoices();
    const { missionId, participantId } = await morningWithOneDone();
    const roster = await loadRoster();
    const s = await loadMorning();
    const base = roster.bases.find((b) => b.id === s.morning.missions.find((m) => m.id === missionId)!.baseId)!;
    // 紐づいていない人は家族として受け付けない
    expect(await familyVoiceRequester(missionId, "U-stranger")).toBeUndefined();
    await repo().addFamilyLink({ familyLineUserId: "U-grandchild", requesterId: base.requesterId, linkCode: "FAM123" });
    expect(await familyVoiceRequester(missionId, "U-grandchild")).toBe(base.requesterId);

    expect((await applyVoiceThanks(missionId, base.requesterId, audio)).ok).toBe(true);
    const fam = { ...audio, bytes: new Uint8Array([26, 69, 223, 163, 9, 9]), seconds: 5 };
    expect((await applyVoiceThanks(missionId, base.requesterId, fam, new Date(), { family: true })).ok).toBe(true);
    // 家の人の声はそのまま、家族の声は <ID>-family に
    expect((await readThanksVoice(missionId, participantId))?.audio).toEqual(audio.bytes);
    expect((await readThanksVoice(familyVoiceId(missionId), participantId))?.audio).toEqual(fam.bytes);
    expect((await findThanksVoice(familyVoiceId(missionId)))?.seconds).toBe(5);
    expect(voiceFromName("小林さん", true)).toBe("小林さんのご家族");
    expect(voiceFromName("高橋", true)).toBe("高橋さんのご家族");
    expect(t(MSG.voiceToHelper(voiceFromName("高橋", true), 2, familyVoiceId(missionId)))).toContain("高橋さんのご家族（拠点2）から");
    // 家族への「終わりました」に「🎤 声でありがとう」
    const done = MSG.familyDone(["田中"], missionId);
    expect(actionsOf(done.at(-1)!).map((a) => a.label)).toEqual(["🎤 声でありがとう"]);
  });
});
