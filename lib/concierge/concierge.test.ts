// AI参加コンシェルジュ（spec v1.7）: 自由な文から、その人に開いている参加の方法へ。3往復まで。画像は Claude が場面を選び、プログラムが描く
import { beforeEach, describe, expect, it, vi } from "vitest";
import { guardedAnswer, mockConcierge, tidyConcierge, type ConciergeInput } from "../claude/concierge";
import { actionsOf, textOf } from "../line/flex";
import type { FlexMessage, LineMessage } from "../line/types";
import { renderYouSvg, youImagePath, youParams } from "../line/you-image";
import { DEMO_DATE } from "../morning/flow";
import { announce, plan, ring } from "../morning/ops";
import { memoryRepo } from "../repo";
import type { Participant } from "../types";
import { buildOptions, type ConciergeContext } from "./options";
import { concierge, CONSULT_WORDS } from "./run";

const ctx = (x: Partial<ConciergeContext> = {}): ConciergeContext => ({
  role: "helper",
  hasTeam: true,
  rollcall: "none",
  answered: false,
  going: false,
  shortHouses: 0,
  soloDoneToday: [],
  safety: false,
  firstTime: false,
  tipOk: false,
  ...x,
});
const input = (text: string, c: ConciergeContext, turn = 1): ConciergeInput => ({
  turn,
  role: c.role,
  firstTime: c.firstTime,
  snowCm: 12,
  safety: c.safety,
  hour: 7,
  options: buildOptions(c).map(({ id, title, minutes, points, about, motives }) => ({ id, title, minutes, points, about, motives })),
  history: [],
  text,
  profile: { motives: c.motives ?? [], summary: "" },
});
const t = (ms: LineMessage[]) => ms.map(textOf).join("\n");
const hero = (m: LineMessage) => ((m as FlexMessage).contents.hero?.url as string | undefined) ?? "";

describe("候補はプログラムが絞る", () => {
  it("手伝う側・雪のない日: 自分の家 → 見回り → アプリで3分 → 応援 → なかま…。終えたものは出さない（6つまで）", () => {
    expect(buildOptions(ctx()).map((o) => o.id)).toEqual(["own_house", "patrol", "online", "cheer", "nakama", "baton"]);
    expect(buildOptions(ctx({ soloDoneToday: ["own_house"] })).map((o) => o.id)).toEqual(["patrol", "online", "cheer", "nakama", "baton", "team"]);
  });
  it("方向（spec v1.17）: つながりの人には なかま が前に、ゲームの人には チーム・図鑑 が前に。点呼はいつも先頭。夜は合流に誘わない", () => {
    expect(buildOptions(ctx({ motives: ["connect"] })).map((o) => o.id).slice(0, 2)).toEqual(["nakama", "baton"]);
    expect(buildOptions(ctx({ motives: ["game"] })).map((o) => o.id).slice(0, 3)).toEqual(["own_house", "online", "team"]);
    expect(buildOptions(ctx({ motives: ["connect"], rollcall: "open" }))[0].id).toBe("rollcall");
    expect(buildOptions(ctx({ motives: ["connect"], night: true })).map((o) => o.id)).not.toContain("nakama");
    expect(buildOptions(ctx({ role: "requester", hasTeam: false })).map((o) => o.id)).not.toContain("nakama");
  });
  it("点呼の時間で答えていなければ、点呼が先。作戦中で人手不足なら、その家へ。向かっている人には行き先", () => {
    expect(buildOptions(ctx({ rollcall: "open" }))[0].id).toBe("rollcall");
    expect(buildOptions(ctx({ rollcall: "planned", answered: true, shortHouses: 2 }))[0].id).toBe("join");
    expect(buildOptions(ctx({ rollcall: "planned", answered: true, going: true }))[0].id).toBe("my_mission");
  });
  it("安全注意の朝は、家の中でできることを前に。お願いする側には体を使う活動を前に出さない", () => {
    expect(buildOptions(ctx({ safety: true }))[0].id).toBe("online");
    const req = buildOptions(ctx({ role: "requester", hasTeam: false, tipOk: true })).map((o) => o.id);
    expect(req.slice(0, 3)).toEqual(["tip", "online", "cheer"]);
    expect(buildOptions(ctx({ role: "requester", hasTeam: false, safety: true })).map((o) => o.id)).not.toContain("own_house");
  });
  it("チームのない人には点を出さない", () => {
    expect(buildOptions(ctx({ role: "requester", hasTeam: false })).every((o) => o.points === 0)).toBe(true);
  });
});

describe("選び方（キーなしの言葉の一覧）と点検", () => {
  it("「何からすればいいか分からない」→ いちばん小さく始めやすいもの（自分の家の前）", () => {
    const c = ctx({ firstTime: true });
    expect(mockConcierge(input("何からすればいいか分からない", c)).pick).toBe("own_house");
    expect(mockConcierge(input("はじめてです", c)).reply).toContain("はじめて");
  });
  it("「仕事で行けない」→ 家の中でできること。点呼中なら点呼（休むも答え）", () => {
    expect(mockConcierge(input("今日は仕事で行けない", ctx())).pick).toBe("online");
    expect(mockConcierge(input("今日は仕事で行けない", ctx({ rollcall: "open" }))).pick).toBe("rollcall");
  });
  it("「手伝いたい」→ 人手不足の家があればそこ", () => {
    expect(mockConcierge(input("何か手伝いたい", ctx({ rollcall: "planned", answered: true, shortHouses: 1 }))).pick).toBe("join");
  });
  it("方向を読む（spec v1.17）: 「仲間がほしい」→ なかま、「体を動かしたい」→ 自分の家か人手不足の家、「カードを集めたい」→ 図鑑。理由が付く", () => {
    const a = mockConcierge(input("雪かきで仲間がほしい", ctx()));
    expect(a.motives).toEqual(["connect"]);
    expect(a.pick).toBe("nakama");
    expect(a.why).toContain("つながり");
    expect(mockConcierge(input("運動不足なので体を動かしたい", ctx())).pick).toBe("own_house");
    expect(mockConcierge(input("カードを集めたい", ctx())).pick).toBe("own_house");
    expect(mockConcierge(input("図鑑を埋めたい。カード集め", ctx({ soloDoneToday: ["own_house"] }))).pick).toBe("team");
    // 前に分かっている方向も効く
    expect(mockConcierge(input("どうしようかな", ctx({ motives: ["connect"] }))).pick).toBe("nakama");
  });
  it("分からない文は聞き返す（1往復目）。3往復目は必ず1つ選ぶ", () => {
    const c = ctx();
    const first = mockConcierge(input("うーん", c));
    expect(first.pick).toBeNull();
    expect(first.question).toBeTruthy();
    const opts = buildOptions(c);
    const forced = tidyConcierge({ ...first }, input("うーん", c, 3), opts);
    expect(forced.option?.id).toBe("own_house");
  });
  it("候補の外の pick は使わない・長い返事は2文まで・体のことばの返事は出さない", () => {
    const c = ctx();
    const opts = buildOptions(c);
    const r = tidyConcierge(
      { reply: "屋根に上りましょう。とても大事です。三文目です。", pick: "roof", question: null, caption: "<b>がんばれ</b>12345", sky: "dawn", motives: [], why: null, summary: "", voice: { category: "none", text: "" } },
      input("何すれば", c),
      opts,
    );
    expect(r.option).toBeNull();
    expect(r.reply).toBe("屋根に上りましょう。とても大事です。");
    expect(r.caption).not.toMatch(/[<>]|\d{3}/);
    const body = tidyConcierge({ reply: "腰が痛いなら休みましょう。", pick: "online", question: null, caption: "x", sky: "dawn", motives: ["exercise", "bad" as never], why: "腰のため", summary: "腰が痛い人", voice: { category: "trouble", text: "腰が痛くてできない" } }, input("a", c), opts);
    expect(body.voice).toBeUndefined(); // 体のことの声は貯めない
    expect(body.motives).toEqual(["exercise"]);
    expect(body.why).toBeUndefined(); // 体のことばの理由は出さない
    expect(body.summary).toBe(""); // 体のことは残さない
    expect(body.reply).not.toContain("腰");
  });
  it("体のことば・危ない作業のことばには、Claude を使わず決まった返事（体調は判断しない）", () => {
    const c = ctx();
    const g1 = guardedAnswer(input("腰が痛くてできない", c), buildOptions(c));
    expect(g1?.guarded).toBe("body");
    expect(g1?.reply).toContain("かかりつけ");
    expect(g1?.option?.id).toBe("online");
    const g2 = guardedAnswer(input("屋根の雪下ろしを手伝いたい", c), buildOptions(c));
    expect(g2?.guarded).toBe("danger");
    expect(g2?.reply).toContain("お願いしていません");
    expect(guardedAnswer(input("何からすればいい？", c), buildOptions(c))).toBeNull();
  });
  it("相談らしい文を見分ける（点呼の答えより先にコンシェルジュへ）", () => {
    expect(CONSULT_WORDS.test("何からすればいいか分からない")).toBe(true);
    expect(CONSULT_WORDS.test("20分なら行けます")).toBe(false);
  });
});

describe("その人用の画像（場面は Claude、描くのはプログラム）", () => {
  it("URL から描ける。変な値は既定に。氏名や場所は載らない", () => {
    const path = youImagePath({ sky: "dawn", prop: "shovel", caption: "あなたの家から町が変わる", title: "自分の家の雪かき", minutes: 10, points: 5, teamId: "salvia" });
    const q = new URL(`http://x${path}`).searchParams;
    const p = youParams(q);
    expect(p).toMatchObject({ sky: "dawn", prop: "shovel", minutes: 10, points: 5, teamId: "salvia" });
    const svg = renderYouSvg(p);
    expect(svg).toContain("サルビアのあなたへ");
    expect(svg).toContain("10分 ・ チーム +5点");
    const bad = youParams(new URLSearchParams({ sky: "hell", p: "knife", c: "<script>", pt: "999", t: "red" }));
    expect(bad).toMatchObject({ sky: "morning", prop: "shovel", points: 15, teamId: undefined });
    expect(renderYouSvg(bad)).not.toContain("<script>");
  });
});

describe("LINE の流れ（キーなし）", () => {
  beforeEach(() => {
    for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive", "__shimaenaConcierge", "__shimaenaSoloScores"]) delete (globalThis as Record<string, unknown>)[k];
  });
  const now = new Date("2026-12-14T08:30:00+09:00");
  const me: Participant = { id: "p-cc", nickname: "新人", role: "helper", location: [43.0401, 141.3699], lineUserId: "U-cc", teamId: "lupinus", morningMinutes: 30, hasTools: true };

  it("登録していない人には答えない（登録の会話へ）", async () => {
    expect(await concierge("U-nobody", "何からすればいい？", now)).toBeNull();
  });

  it("分からない → その人用の画像つきカードと、アプリへのボタン1つ（返信だけ・通数0）", async () => {
    await memoryRepo.upsertParticipant(me);
    const ms = (await concierge("U-cc", "何からすればいいか分からない", now))!;
    expect(ms).toHaveLength(1);
    expect(hero(ms[0])).toContain("/api/line/hero/you.png");
    expect(hero(ms[0])).toContain("t=lupinus");
    const btn = actionsOf(ms[0]).find((a) => a.type === "uri") as { uri: string } | undefined;
    expect(btn?.uri).toContain("/solo?pick=10&focus=own_house");
  });

  it("分からない文は聞き返し、3往復目で必ず選んで終える", async () => {
    await memoryRepo.upsertParticipant(me);
    const a1 = (await concierge("U-cc", "うーん", now))!;
    expect(hero(a1[0])).toBe("");
    expect(t(a1)).toContain("？");
    const a2 = (await concierge("U-cc", "そうだなあ", now))!;
    expect(hero(a2[0])).toBe("");
    const a3 = (await concierge("U-cc", "どうかな", now))!;
    expect(hero(a3[0])).toContain("you.png");
    // 終わったら会話は消える: 次はまた1往復目
    const again = (await concierge("U-cc", "うーん", now))!;
    expect(hero(again[0])).toBe("");
  });

  it("作戦中・人手不足の朝は、手伝いたい人を地図の家へ", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    await plan();
    await memoryRepo.upsertParticipant(me);
    const ms = (await concierge("U-cc", "何か手伝いたい", new Date(`${DEMO_DATE}T07:00:00+09:00`)))!;
    const uri = (actionsOf(ms[0]).find((a) => a.type === "uri") as { uri: string } | undefined)?.uri ?? "";
    // 人手が足りない家があれば地図、なければ自分の家の前
    expect(uri).toMatch(/\/map|focus=own_house|focus=patrol/);
    vi.restoreAllMocks();
  });
});
