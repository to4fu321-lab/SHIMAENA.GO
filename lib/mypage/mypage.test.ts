import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../storm", () => ({ stormStopText: async () => undefined }));
vi.mock("../line/client", () => ({ push: vi.fn(async () => true) }));

import { push } from "../line/client";
import { memoryRepo } from "../repo";
import { insertMeetup } from "../nakama/store";
import type { Card, Participant } from "../types";
import { mutualWavesOf, mypageView, saveProfile, waveTo } from "./ops";
import {
  cleanIntro,
  cleanTags,
  hasContent,
  normalizeProfileTurns,
  PROFILE_QUESTIONS,
  suggestIcon,
  templateProfile,
  waveState,
  type Wave,
} from "./rules";
import { resetMypageMemory } from "./store";
import { defaultLook } from "./rules";

const NOW = new Date("2026-12-14T01:00:00Z"); // 10:00 JST

const person = (id: string, nickname: string, over: Partial<Participant> = {}): Participant => ({ id, nickname, role: "helper", location: [43.04, 141.37], teamId: "salvia", ...over });
const card = (recipientId: string, missionId: string, createdAt: string): Card => ({
  id: `c-${recipientId}-${missionId}`,
  recipientId,
  rollcallId: "rc1",
  missionId,
  serial: 1,
  issuedCount: 2,
  designName: "x",
  designNameEn: "x",
  rarityLabel: "x",
  stars: 1,
  style: "kawaii",
  snowKg: 10,
  snowKgComparison: "x",
  memberNames: [],
  teamIds: ["salvia"],
  createdAt,
});

describe("プロフィールの点検", () => {
  it("札は区切って短くし、名前・住所・体の話は落とす", () => {
    expect(cleanTags("散歩、料理 と ラジオ・庭いじり")).toEqual(["散歩", "料理", "ラジオ", "庭いじり"]);
    expect(cleanTags("犬が好きです、読書です")).toEqual(["犬", "読書"]);
    expect(cleanTags(["a", "a", "b", "c", "d", "e", "f"]).length).toBe(5);
    expect(cleanTags("札幌市北区3丁目5番地")).toEqual([]);
    expect(cleanTags("ながいながいながい趣味の名前です")).toEqual([]);
    expect(cleanTags("通院のこと")).toEqual([]);
  });
  it("ひとことは 40 字までで、名前はご近所さんに", () => {
    expect(cleanIntro("田中さんと朝に歩いています。よろしく。")).toBe("ご近所さんと朝に歩いています。よろしく");
    expect(cleanIntro("あ".repeat(60)).length).toBe(40);
  });
  it("答えから組み立てる（キーなし）: ひとことがなければ好きなことから", () => {
    const turns = normalizeProfileTurns([
      { q: PROFILE_QUESTIONS[0].q, a: "犬の散歩、料理" },
      { q: PROFILE_QUESTIONS[1].q, a: "パン作り" },
      { q: "知らない質問", a: "x" },
    ]);
    expect(turns.length).toBe(2);
    const p = templateProfile(turns);
    expect(p.likes).toEqual(["犬の散歩", "料理"]);
    expect(p.interests).toEqual(["パン作り"]);
    expect(p.intro).toBe("犬の散歩が好きです。パン作りに興味があります。よろしくお願いします");
    expect(p.icon).toBe("dog");
    expect(hasContent(p)).toBe(true);
  });
  it("アイコンのおすすめ: ことばがなければシマエナガ", () => {
    expect(suggestIcon(["温泉"])).toBe("onsen");
    expect(suggestIcon(["なにもなし"])).toBe("bird");
  });
});

describe("手ふり", () => {
  it("30日のあいだ生きる。両方ふればおたがい", () => {
    const waves: Wave[] = [
      { fromId: "a", toId: "b", at: "2026-12-10T00:00:00Z" },
      { fromId: "b", toId: "a", at: "2026-10-01T00:00:00Z" }, // 古い
    ];
    expect(waveState("a", "b", waves, NOW)).toEqual({ mine: true, theirs: false, mutual: false });
    waves.push({ fromId: "b", toId: "a", at: "2026-12-13T00:00:00Z" });
    expect(waveState("a", "b", waves, NOW).mutual).toBe(true);
  });
});

describe("マイページ（メモリ）", () => {
  beforeEach(async () => {
    resetMypageMemory();
    vi.mocked(push).mockClear();
    const { resetMemoryRoster } = await import("../repo");
    const { resetNakamaMemory } = await import("../nakama/store");
    resetNakamaMemory();
    resetMemoryRoster([person("h1", "たろう"), person("h2", "はなこ", { teamId: "lupinus" }), person("h3", "じろう"), person("r1", "小林", { role: "requester" })], []);
    // h1 と h2 は同じ家のカードを一緒に受け取った。h1 と h3 は合流が成立
    await memoryRepo.insertCard(card("h1", "m1", "2026-12-10T00:00:00Z"), "<svg/>", "<svg/>");
    await memoryRepo.insertCard(card("h2", "m1", "2026-12-10T00:00:00Z"), "<svg/>", "<svg/>");
    await insertMeetup({ id: "mt1", date: "2026-12-13", fromId: "h3", toId: "h1", kind: "nearby", window: "now10", status: "accepted", message: "x", createdAt: "2026-12-13T00:00:00Z", respondedAt: "2026-12-13T00:10:00Z" });
    await insertMeetup({ id: "mt2", date: "2026-12-13", fromId: "r1", toId: "h1", kind: "nearby", window: "now10", status: "declined", message: "x", createdAt: "2026-12-13T00:00:00Z" });
  });

  it("なかま帳は、一緒に活動した人だけ（見送りの相手は入らない）", async () => {
    const v = await mypageView("h1", NOW);
    expect(v).toBeDefined();
    const ids = v!.companions.map((c) => c.participantId).sort();
    expect(ids).toEqual(["h2", "h3"]);
    const h3 = v!.companions.find((c) => c.participantId === "h3")!;
    expect(h3.how).toBe("meetup");
    expect(h3.last).toBe("12/13");
    expect(v!.stats.companions).toBe(2);
    expect(v!.stats.meets).toBe(1);
    expect(v!.stats.cards).toBe(1);
  });

  it("プロフィールは点検して保存し、仲間に見える。初期値は人ごとにランダム（ID で決まる）", async () => {
    const r = await saveProfile("h2", { icon: "cat", intro: "ねこと暮らしています。田中さんの隣です。", likes: "ねこ、編み物", interests: ["温泉"], talk: "ねこの話" }, NOW);
    expect(r.ok).toBe(true);
    expect(r.profile?.icon).toBe("cat");
    expect(r.profile?.intro).toBe("ねこと暮らしています。ご近所さんの隣です");
    const v = await mypageView("h1", NOW);
    const h2 = v!.companions.find((c) => c.participantId === "h2")!;
    expect(h2.hasProfile).toBe(true);
    expect(h2.profile.likes).toEqual(["ねこ", "編み物"]);
    expect(v!.companions.find((c) => c.participantId === "h3")!.profile.icon).toBe(defaultLook("h3").icon);
    // 知らないアイコンは前のまま
    const r2 = await saveProfile("h2", { icon: "unknown" }, NOW);
    expect(r2.profile?.icon).toBe("cat");
    expect(r2.profile?.likes).toEqual(["ねこ", "編み物"]);
    // 写真: 縮めた data URL だけ。undefined は前のまま、null でやめる
    const photo = "data:image/jpeg;base64,AAAA";
    expect((await saveProfile("h2", { photo }, NOW)).profile?.photo).toBe(photo);
    expect((await saveProfile("h2", { intro: "よろしく" }, NOW)).profile?.photo).toBe(photo);
    expect((await saveProfile("h2", { photo: null }, NOW)).profile?.photo).toBeUndefined();
    expect((await saveProfile("h2", { photo: "javascript:alert(1)" }, NOW)).profile?.photo).toBeUndefined();
  });

  it("初期アイコンは ID ごとに決まり、いつも同じ。人によってばらばら", () => {
    expect(defaultLook("p-abc")).toEqual(defaultLook("p-abc"));
    const icons = new Set(["a", "b", "c", "d", "e", "f", "g", "h"].map((x) => defaultLook(`p-${x}`).icon));
    expect(icons.size).toBeGreaterThan(3);
  });

  it("手をふれるのは仲間だけ。1回だけ知らせる。おたがいなら候補の先に", async () => {
    expect((await waveTo("h1", "r1", NOW)).ok).toBe(false); // 一緒に活動していない
    const r = await waveTo("h1", "h2", NOW);
    expect(r.ok).toBe(true);
    expect(r.mutual).toBe(false);
    expect(push).toHaveBeenCalledTimes(1);
    expect((await waveTo("h1", "h2", NOW)).ok).toBe(false); // もうふっている
    const v2 = await mypageView("h2", NOW);
    expect(v2!.wavesForMe).toBe(1);
    expect(v2!.companions[0].participantId).toBe("h1"); // 手をふってくれた人が先
    const back = await waveTo("h2", "h1", NOW);
    expect(back.mutual).toBe(true);
    expect([...(await mutualWavesOf("h1", NOW))]).toEqual(["h2"]);
    expect((await mypageView("h1", NOW))!.wavesForMe).toBe(0);
  });
});
