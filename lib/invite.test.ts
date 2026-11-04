// 仲間を増やす仕掛け（spec v1.8）: 相手別の3案・本当の出来事・招待の印・誘った結果を本人に返す
import { beforeEach, describe, expect, it, vi } from "vitest";
import { inviteOk, mockInvites } from "./claude/invite";
import { actionsOf } from "./line/flex";
import { inviteCode, inviteResultLine, inviteUrl, isInviteCode, linkInvitee, readInviteStats, recordInviteCheer, recordInviteOpen } from "./invite";
import { DEMO_DATE, fillAnswers } from "./morning/flow";
import { announce, applyThanks, completeWithPhoto, plan, ring } from "./morning/ops";
import { loadRoster } from "./morning/roster";
import { loadMorning, saveMorning } from "./morning/store";
import { memoryRepo } from "./repo";
import { completeSolo } from "./solo/ops";

const reset = () => {
  for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive", "__shimaenaSoloScores", "__shimaenaPhotoSeen", "__shimaenaInvites", "__shimaenaInvited"]) delete (globalThis as Record<string, unknown>)[k];
};

describe("招待の印", () => {
  it("参加者ごとに決まった8文字。ID や名前は入っていない", () => {
    const c = inviteCode("p-abc123");
    expect(isInviteCode(c)).toBe(true);
    expect(c).toBe(inviteCode("p-abc123"));
    expect(c).not.toBe(inviteCode("p-xyz"));
    expect(c).not.toContain("abc");
    expect(inviteUrl("p-abc123")).toContain(`/public/town?via=invite&r=${c}`);
    expect(isInviteCode("<script>")).toBe(false);
  });
  it("見てくれた人・応援してくれた人を数え、本人に返すひとことにする（0 なら出さない）", async () => {
    reset();
    expect(inviteResultLine(await readInviteStats("p-1"))).toBeUndefined();
    const c = inviteCode("p-1");
    await recordInviteOpen(c);
    await recordInviteOpen(c);
    await recordInviteCheer(c);
    await recordInviteOpen("bad code");
    expect(await readInviteStats("p-1")).toEqual({ opens: 2, cheers: 1, joined: 0 });
    expect(inviteResultLine({ opens: 2, cheers: 1, joined: 0 })).toBe("あなたの誘いで、2人が見てくれて、1人が町を応援してくれました。");
    expect(inviteResultLine({ opens: 3, cheers: 0, joined: 1 })).toBe("あなたの誘いで、3人が見てくれて、1人が仲間になってくれました。");
  });
});

describe("相手別の3案（キーなしの定型）", () => {
  it("友だちへ・家族へ・職場や学校の人へ。kg・カード・ありがとうがあれば入る。名前や作った数字はない", () => {
    const d = mockInvites({ minutes: 10, firstTime: false, snowCm: 12, snowKg: 220, cardName: "玄関までの三十歩", thanks: "助かりました", solo: true });
    expect(d).toHaveLength(3);
    expect(d[0]).toContain("220kg");
    expect(d[0]).toContain("玄関までの三十歩");
    expect(d[1]).toContain("助かりました");
    for (const x of d) expect(inviteOk(x.length > 70 ? x.slice(0, 70) : x, [10, 12, 220, 1])).toBe(true);
  });
});

describe("誘う瞬間", () => {
  beforeEach(() => {
    reset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  it("家の完了: 招待リンクに本人の印、誘った結果が返事に入る", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    const s = await loadMorning();
    fillAnswers(s, await loadRoster(), 7);
    await saveMorning(s);
    await plan();
    const going = (await loadMorning()).morning.sorties.find((x) => x.status === "going")!;
    await recordInviteOpen(inviteCode(going.participantId));
    const r = await completeWithPhoto(going.participantId, { bytes: new Uint8Array([5, 4, 3]), mediaType: "image/jpeg" }, new Date(`${DEMO_DATE}T07:20:00+09:00`));
    expect(r.clear?.inviteUrl).toContain(`r=${inviteCode(going.participantId)}`);
    expect(r.clear?.inviteResult).toContain("1人が見てくれました");
    const share = actionsOf(r.messages.at(-1)!).find((a) => a.label === "友だちを誘う");
    expect(share && "uri" in share && decodeURIComponent(share.uri)).toContain(`r=${inviteCode(going.participantId)}`);
  });

  it("「ありがとう」が届いたプッシュに「友だちを誘う」（同じ1回のプッシュ）", async () => {
    const sent: unknown[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void sent.push(a.join(" ")));
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    const s = await loadMorning();
    fillAnswers(s, await loadRoster(), 7);
    await saveMorning(s);
    await plan();
    const going = (await loadMorning()).morning.sorties.find((x) => x.status === "going")!;
    const roster = await loadRoster();
    const me = roster.participants.find((p) => p.id === going.participantId)!;
    await memoryRepo.upsertParticipant({ ...me, lineUserId: "U-helper" });
    await completeWithPhoto(going.participantId, { bytes: new Uint8Array([6, 6, 6]), mediaType: "image/jpeg" }, new Date(`${DEMO_DATE}T07:20:00+09:00`));
    sent.length = 0;
    await applyThanks(going.missionId, "1");
    const push = sent.map(String).find((x) => x.includes("/message/push") && x.includes("U-helper")) ?? "";
    expect(push).toContain("友だちを誘う");
    expect(push).toContain(encodeURIComponent(`r=${inviteCode(going.participantId)}`).slice(0, 10));
  });

  it("ソロの完了: 3案と招待リンクがクリア画面に", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    const r = await completeSolo("h3", "own_house", { now: new Date("2026-11-03T03:00:00Z") });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.summary.invites).toHaveLength(3);
    expect(r.summary.invites![0]).toContain("kg");
    expect(r.summary.inviteUrl).toContain(`r=${inviteCode("h3")}`);
  });
});

describe("誘っただけで羽、仲間になったら二人にカード（水増しより参加者を増やすのが最優先）", () => {
  beforeEach(() => {
    reset();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  const feathersOf = async (pid: string, kind: string) =>
    (await memoryRepo.listSoloLogsByParticipant(pid)).filter((l) => l.kind === kind).reduce((a, l) => a + l.feathers, 0);

  it("誘ったリンクを開いてくれたら +2羽、応援してくれたら +3羽（何回でも）。活動日には数えない", async () => {
    inviteUrl("h3"); // リンクを作ると、この印が h3 のものと覚える
    await new Promise((r) => setTimeout(r, 0));
    const c = inviteCode("h3");
    await recordInviteOpen(c);
    await recordInviteOpen(c);
    await recordInviteCheer(c);
    expect(await feathersOf("h3", "bonus_invite_open")).toBe(4);
    expect(await feathersOf("h3", "bonus_invite_cheer")).toBe(3);
  });

  it("招待リンクから来て登録した人の初出動: 二人に「ふたりの群れ」、誘った人に +20羽。2回目からはふつう", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    inviteUrl("h3");
    await new Promise((r) => setTimeout(r, 0));
    expect(await linkInvitee("h5", inviteCode("h3"))).toBe(true);
    expect(await linkInvitee("h5", inviteCode("h4"))).toBe(false); // 最初の1回だけ
    expect(await linkInvitee("h3", inviteCode("h3"))).toBe(false); // 自分で自分は誘えない
    const now = new Date("2026-11-03T03:00:00Z");
    const r = await completeSolo("h5", "own_house", { now });
    expect(r.ok && r.summary.card?.designName).toBe("ふたりの群れ");
    const mine = await memoryRepo.listCardsByRecipient("h3");
    expect(mine.map((c) => c.designName)).toContain("ふたりの群れ");
    expect(await feathersOf("h3", "bonus_invite_join")).toBe(20);
    expect((await readInviteStats("h3")).joined).toBe(1);
    const r2 = await completeSolo("h5", "report_snow", { now });
    expect(r2.ok && r2.summary.card?.designName).not.toBe("ふたりの群れ");
    expect((await memoryRepo.listCardsByRecipient("h3")).length).toBe(mine.length);
  });

  it("ふだんの1枚は LINE に送らない（月の通数を使わない）。はじめての1枚は送る", async () => {
    const logs: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => void logs.push(a.join(" ")));
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    const roster = await loadRoster();
    const me = roster.participants.find((p) => p.id === "h6")!;
    await memoryRepo.upsertParticipant({ ...me, lineUserId: "U-h6" });
    const now = new Date("2026-11-03T03:00:00Z");
    logs.length = 0;
    await completeSolo("h6", "own_house", { now });
    expect(logs.some((x) => x.includes("/message/push") && x.includes("U-h6"))).toBe(true); // はじめて
    logs.length = 0;
    await completeSolo("h6", "report_snow", { now });
    expect(logs.some((x) => x.includes("/message/push") && x.includes("U-h6"))).toBe(false); // ふだんの1枚
  });
});

