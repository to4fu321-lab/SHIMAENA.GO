import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../storm", () => ({ stormStopText: async () => undefined }));

import { memoryRepo } from "../repo";
import type { Card, Participant } from "../types";
import { answerMeetup, leaveBaton, nakamaView, proposeMeetup, reactToBaton, setNextWish, setTodayMode } from "./ops";
import {
  activeMode,
  aiLineOk,
  areaKey,
  cleanBatonText,
  excludedFor,
  modesMatch,
  pickCandidates,
  respond,
  statusNow,
  suggestedMode,
  type Meetup,
  type Person,
} from "./rules";
import { resetNakamaMemory } from "./store";

// 日本時間 10:00（昼）。デモの朝の日付と同じ日
const NOW = new Date("2026-12-14T01:00:00Z");
const NIGHT = new Date("2026-12-14T12:00:00Z"); // 21:00 JST

const person = (id: string, over: Partial<Person> = {}): Person => ({ id, home: [43.04, 141.37], role: "helper", newcomer: false, reachable: true, ...over });

const meetup = (over: Partial<Meetup> = {}): Meetup => ({
  id: "m1",
  date: "2026-12-14",
  fromId: "a",
  toId: "b",
  kind: "nearby",
  window: "now10",
  status: "proposed",
  message: "近くで活動中の参加者がいます。",
  createdAt: NOW.toISOString(),
  ...over,
});

describe("交流の希望（規則）", () => {
  it("ひとりで・選んでいない・3時間より前・別の日は、交流しない", () => {
    expect(activeMode(undefined, "2026-12-14", NOW)).toBeUndefined();
    expect(activeMode({ participantId: "a", todayMode: "solo", todayDate: "2026-12-14", todayAt: NOW.toISOString() }, "2026-12-14", NOW)).toBeUndefined();
    expect(activeMode({ participantId: "a", todayMode: "together", todayDate: "2026-12-13", todayAt: NOW.toISOString() }, "2026-12-14", NOW)).toBeUndefined();
    const old = new Date(NOW.getTime() - 4 * 3600_000).toISOString();
    expect(activeMode({ participantId: "a", todayMode: "together", todayDate: "2026-12-14", todayAt: old }, "2026-12-14", NOW)).toBeUndefined();
    expect(activeMode({ participantId: "a", todayMode: "together", todayDate: "2026-12-14", todayAt: NOW.toISOString() }, "2026-12-14", NOW)).toBe("together");
  });

  it("前回の「次は？」が、今日のスタイルの最初の選択になる（押すまでは何も始まらない）", () => {
    expect(suggestedMode("reunion")).toBe("reunion");
    expect(suggestedMode("new")).toBe("new");
    expect(suggestedMode("solo")).toBe("solo");
    expect(suggestedMode(undefined)).toBe("solo");
  });

  it("スタイルが合う組だけ（両方の希望を守る）", () => {
    expect(modesMatch("reunion", "together", true)).toBe(true);
    expect(modesMatch("reunion", "together", false)).toBe(false);
    expect(modesMatch("new", "reunion", true)).toBe(false);
    expect(modesMatch("new", "new", false)).toBe(true);
  });
});

describe("合流の候補（規則）", () => {
  const base = { companions: new Set<string>(), meets: new Map<string, number>(), excluded: new Set<string>() };

  it("再会希望では前回の仲間が先、会った回数が少ない仲間から", () => {
    const c = pickCandidates({
      ...base,
      me: person("me"),
      myMode: "reunion",
      others: [
        { person: person("p1"), mode: "together" },
        { person: person("p2"), mode: "reunion" },
        { person: person("x"), mode: "together" },
      ],
      companions: new Set(["p1", "p2"]),
      meets: new Map([["p1", 4]]),
    });
    expect(c.map((x) => x.participantId)).toEqual(["p2", "p1"]); // 仲間でない x は出ない
    expect(c[0].kind).toBe("reunion");
  });

  it("同じ人ばかりにしない: 「一緒に」ではよく会う相手を後ろへ", () => {
    const c = pickCandidates({
      ...base,
      me: person("me"),
      myMode: "together",
      others: [
        { person: person("often"), mode: "together" },
        { person: person("fresh"), mode: "together" },
      ],
      meets: new Map([["often", 3]]),
    });
    expect(c[0].participantId).toBe("fresh");
  });

  it("初参加の人を経験者に先に出す（歓迎）。初参加の人には経験者を先に", () => {
    const welcome = pickCandidates({
      ...base,
      me: person("me"),
      myMode: "together",
      others: [
        { person: person("vet"), mode: "together" },
        { person: person("rookie", { newcomer: true }), mode: "together" },
      ],
    });
    expect(welcome[0]).toMatchObject({ participantId: "rookie", kind: "welcome" });
    const senior = pickCandidates({
      ...base,
      me: person("me", { newcomer: true }),
      myMode: "together",
      others: [
        { person: person("rookie2", { newcomer: true }), mode: "together" },
        { person: person("vet"), mode: "together" },
      ],
    });
    expect(senior[0]).toMatchObject({ participantId: "vet", kind: "senior" });
  });

  it("遠い人・出さない相手・自分は候補にしない。最大3人", () => {
    const c = pickCandidates({
      ...base,
      me: person("me"),
      myMode: "together",
      others: [
        { person: person("me"), mode: "together" },
        { person: person("far", { home: [43.06, 141.37] }), mode: "together" },
        { person: person("ng"), mode: "together" },
        ...["a", "b", "c", "d"].map((id) => ({ person: person(id), mode: "together" as const })),
      ],
      excluded: new Set(["ng"]),
    });
    expect(c.map((x) => x.participantId)).not.toContain("far");
    expect(c.map((x) => x.participantId)).not.toContain("ng");
    expect(c.map((x) => x.participantId)).not.toContain("me");
    expect(c).toHaveLength(3);
  });
});

describe("合流の同意（規則）", () => {
  it("答えられるのは誘われた本人だけ。期限を過ぎたら成立しない", () => {
    expect(respond(meetup(), "a", true, NOW)).toEqual({ ok: false, reason: "not_yours" });
    const late = new Date(NOW.getTime() + 31 * 60_000);
    expect(statusNow(meetup(), late)).toBe("expired");
    expect(respond(meetup(), "b", true, late)).toEqual({ ok: false, reason: "expired" });
    const r = respond(meetup(), "b", true, NOW);
    expect(r.ok && r.meetup.status).toBe("accepted");
    expect(respond({ ...meetup(), status: "declined" }, "b", true, NOW)).toEqual({ ok: false, reason: "closed" });
  });

  it("見送られた相手は、今日は候補に出さない。7日で2回なら7日出さない", () => {
    const today = excludedFor("a", [meetup({ status: "declined" })], "2026-12-14", NOW, "2026-12-07");
    expect(today.has("b")).toBe(true);
    const week = excludedFor(
      "a",
      [meetup({ id: "1", date: "2026-12-10", status: "declined" }), meetup({ id: "2", date: "2026-12-12", status: "declined" })],
      "2026-12-14",
      NOW,
      "2026-12-07",
    );
    expect(week.has("b")).toBe(true);
  });
});

describe("バトンと AI の文の点検（規則）", () => {
  it("ひとことに名前・番号・場所の言い方は使えない", () => {
    expect(cleanBatonText("砂まきお願いします")).toBe("砂まきお願いします");
    expect(cleanBatonText("みなさんありがとう")).toBe("みなさんありがとう");
    expect(cleanBatonText("佐藤さんの家")).toBeUndefined();
    expect(cleanBatonText("3丁目の角")).toBeUndefined();
    expect(cleanBatonText("090-1234-5678")).toBeUndefined();
    expect(cleanBatonText("あ".repeat(31))).toBeUndefined();
  });

  it("AI の文: 恋愛・気持ちの推測・入力にない数字・長すぎは使わない", () => {
    expect(aiLineOk("近くの人と10分だけ一緒にどうですか？", 45, [10])).toBe(true);
    expect(aiLineOk("運命の相手かも！10分だけ", 45, [10])).toBe(false);
    expect(aiLineOk("寂しい人がいます", 45, [])).toBe(false);
    expect(aiLineOk("今日は7人が参加", 45, [5])).toBe(false);
    expect(aiLineOk("あ".repeat(46), 45, [])).toBe(false);
  });
});

// ---- 画面と LINE の処理（メモリ保存で通す） ----

const withLine = async (id: string) => {
  const p = (await memoryRepo.findParticipant(id)) as Participant;
  await memoryRepo.upsertParticipant({ ...p, lineUserId: `U-${id}` });
};
const giveCard = async (recipientId: string, missionId: string) => {
  const card = { id: `c-${recipientId}-${missionId}`, recipientId, rollcallId: "rc", missionId, serial: 1, issuedCount: 2, designName: "x", designNameEn: "x", rarityLabel: "x", stars: 1, style: "kawaii", snowKg: 0, snowKgComparison: "", memberNames: [], teamIds: [], createdAt: NOW.toISOString() } as Card;
  await memoryRepo.insertCard(card, "<svg/>", "<svg/>");
};

describe("ゆるく合流・再会・バトン（処理）", () => {
  beforeEach(async () => {
    for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive"]) delete (globalThis as Record<string, unknown>)[k];
    resetNakamaMemory();
    for (const id of ["h3", "h6", "h10", "h9"]) await withLine(id);
  });

  it("自由参加はそのまま: 何も選ばなければ候補も誘いも出ない（ひとりで活動できる）", async () => {
    const v = await nakamaView("h3", NOW);
    expect(v?.mode).toBe("solo");
    expect(v?.active).toBe(false);
    expect(v?.candidates).toEqual([]);
    await setTodayMode("h3", "solo", NOW);
    expect((await nakamaView("h3", NOW))?.candidates).toEqual([]);
  });

  it("ひとりを選んだ人は、ほかの人の候補に出ない", async () => {
    await setTodayMode("h3", "together", NOW);
    await setTodayMode("h6", "solo", NOW);
    const v = await nakamaView("h3", NOW);
    expect(v?.candidates.map((c) => c.participantId)).not.toContain("h6");
  });

  it("双方の同意なしに成立しない。断れて、断っても相手に理由は伝えない", async () => {
    await setTodayMode("h3", "together", NOW);
    await setTodayMode("h6", "together", NOW);
    const v = await nakamaView("h3", NOW);
    expect(v?.candidates.map((c) => c.participantId)).toContain("h6");
    // 新しい人の呼び名は、成立するまで出さない
    expect(v?.candidates.find((c) => c.participantId === "h6")?.name).toBeUndefined();

    const sent = await proposeMeetup("h3", "h6", "now10", NOW);
    expect(sent.ok).toBe(true);
    expect((await nakamaView("h3", NOW))?.matched).toEqual([]); // 誘っただけでは成立しない
    const inbox = (await nakamaView("h6", NOW))!.incoming;
    expect(inbox).toHaveLength(1);
    expect((await answerMeetup("h3", inbox[0].id, true, NOW)).ok).toBe(false); // 誘った本人は答えられない

    const no = await answerMeetup("h6", inbox[0].id, false, NOW);
    expect(no.ok).toBe(true);
    const after = await nakamaView("h3", NOW);
    expect(after?.matched).toEqual([]);
    expect(after?.notMatched).toBe(1);
    expect(after?.candidates.map((c) => c.participantId)).not.toContain("h6"); // 今日はもう出さない
    expect((await answerMeetup("h6", inbox[0].id, true, NOW)).ok).toBe(false); // 一度答えたら変えられない
  });

  it("相手の「一緒にやる」で成立し、両方に相手の呼び名が見える", async () => {
    await setTodayMode("h3", "together", NOW);
    await setTodayMode("h6", "together", NOW);
    await proposeMeetup("h3", "h6", "today", NOW);
    const id = (await nakamaView("h6", NOW))!.incoming[0].id;
    const yes = await answerMeetup("h6", id, true, NOW);
    expect(yes.matched?.otherName).toBeTruthy();
    expect((await nakamaView("h3", NOW))?.matched).toHaveLength(1);
    expect((await nakamaView("h6", NOW))?.matched).toHaveLength(1);
  });

  it("候補に出ていない人は誘えない・夜は誘えない", async () => {
    await setTodayMode("h3", "together", NOW);
    expect((await proposeMeetup("h3", "h6", "now10", NOW)).ok).toBe(false); // h6 は何も選んでいない
    await setTodayMode("h6", "together", NOW);
    expect((await proposeMeetup("h3", "h6", "now10", NIGHT)).ok).toBe(false);
  });

  it("再会希望が次回の提案に反映される（前回同じ家のカードをもらった仲間）", async () => {
    await giveCard("h3", "mission-x");
    await giveCard("h10", "mission-x");
    await setNextWish("h3", "reunion");
    expect((await nakamaView("h3", NOW))?.mode).toBe("reunion"); // 最初の選択が「前回の仲間と」
    await setTodayMode("h3", "reunion", NOW);
    await setTodayMode("h10", "together", NOW);
    await setTodayMode("h6", "together", NOW);
    const v = await nakamaView("h3", NOW);
    expect(v?.candidates.map((c) => c.participantId)).toEqual(["h10"]); // 仲間だけ
    expect(v?.candidates[0].name).toBeTruthy(); // 前回の仲間は呼び名で
    expect(v?.wishLine).toContain("また一緒に");
  });

  it("初参加の人が近くにいれば、経験者に「歓迎」として先に出る", async () => {
    await giveCard("h3", "m-a");
    await giveCard("h9", "m-b");
    await setTodayMode("h3", "together", NOW);
    await setTodayMode("h9", "together", NOW);
    await setTodayMode("h6", "together", NOW); // h6 は初参加
    const v = await nakamaView("h3", NOW);
    expect(v?.candidates[0]).toMatchObject({ participantId: "h6", kind: "welcome" });
  });

  it("バトンが同じ地域の次の人に見え、別の地域の人には見えない。名前は出さない", async () => {
    const r = await leaveBaton("h3", { source: "own_house", status: "partial", preset: "砂まきが残っています", photoChecked: true }, NOW);
    expect(r.ok).toBe(true);
    // 同じ地域の人をさがす
    const h3 = (await memoryRepo.findParticipant("h3"))!;
    const people = await memoryRepo.listParticipants();
    const same = people.find((p) => p.id !== "h3" && areaKey(p.location) === areaKey(h3.location))!;
    const other = people.find((p) => areaKey(p.location) !== areaKey(h3.location))!;
    const v = await nakamaView(same.id, NOW);
    expect(v?.area.batons).toHaveLength(1);
    expect(v?.area.batons[0]).toMatchObject({ message: "砂まきが残っています", done: false, photoChecked: true, own: false });
    expect(JSON.stringify(v?.area)).not.toContain(h3.nickname);
    expect((await nakamaView(other.id, NOW))?.area.batons).toHaveLength(0);

    // 前の人ありがとう → 書いた人にだけ数が返る
    const id = v!.area.batons[0].id;
    expect((await reactToBaton(same.id, id, "thanks")).ok).toBe(true);
    expect((await reactToBaton("h3", id, "thanks")).ok).toBe(false); // 自分には押せない
    expect((await reactToBaton(other.id, id, "thanks")).ok).toBe(false); // ほかの地域からは押せない
    expect((await nakamaView("h3", NOW))?.thanksForMe).toBe(1);
  });

  it("バトンのひとことに名前を書いたら受け付けない", async () => {
    const r = await leaveBaton("h3", { source: "own_house", status: "done", text: "田中さんの前まで" }, NOW);
    expect(r.ok).toBe(false);
  });
});
