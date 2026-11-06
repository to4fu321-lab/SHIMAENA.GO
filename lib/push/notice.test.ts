import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MSG } from "../line/messages";
import { buildNotice, noticeKind, quietHours } from "./notice";

const morning = new Date("2026-12-14T07:00:00+09:00");
const night = new Date("2026-12-14T23:30:00+09:00");

describe("通知の種類（ボタンの中身から見分ける）", () => {
  it("点呼・行き先・ヘルプ・声かけ・合流・道・完了・来る人・警報・カード", () => {
    expect(noticeKind(MSG.rollcallRequester(12)).kind).toBe("rollcall");
    expect(noticeKind(MSG.planForHelper("拠点3へ 7:00 に")).kind).toBe("plan");
    expect(noticeKind(MSG.helpRequest("m1", 3, 1, ["偵察（10分）"])).kind).toBe("help");
    expect(noticeKind(MSG.knockRequest("m1", 3)).kind).toBe("knock");
    expect(noticeKind(MSG.nakamaInvite({ id: "n1", fromName: "ゆき", message: "一緒に", windowLabel: "今から10分" })).kind).toBe("nakama");
    const road = noticeKind(MSG.roadAlert({ emoji: "🧊", label: "凍って転びやすい", sentence: "凍って", distance: 120, ago: "3分前", photoUrl: "https://p", reportId: "r1" }));
    expect(road).toEqual({ kind: "road", url: "/map?road=r1" });
    expect(noticeKind(MSG.requesterDoneNotice(["ゆき"], "m1")).kind).toBe("done");
    expect(noticeKind(MSG.familyDone(["ゆき"], "m1")).kind).toBe("done");
    expect(noticeKind(MSG.visitNotice("サルビア（青）", "ゆきだるま", false)).kind).toBe("visit");
    expect(noticeKind(MSG.stormStop("暴風雪警報", ["a", "b", "c"])).kind).toBe("storm");
    expect(noticeKind(MSG.thanksToHelper("花子", "ありがとう", 3, "助かりました", "https://x")).kind).toBe("card");
  });
});

describe("通知の中身", () => {
  it("道の報告は、押すとその報告の地図を開く。同じ種類は1つにまとまる", () => {
    const n = buildNotice(MSG.roadAlert({ emoji: "🧊", label: "凍って転びやすい", sentence: "凍って", distance: 120, ago: "3分前", photoUrl: "https://p", reportId: "r1" }), morning);
    expect(n.payload.url).toBe("/map?road=r1");
    expect(n.payload.tag).toBe("road");
    expect(n.payload.body).toContain("約120m");
  });
  it("ヘルプは急ぎ・1時間で消える。カードは急がない", () => {
    const help = buildNotice(MSG.helpRequest("m1", 3, 1, ["偵察（10分）"]), morning);
    expect(help.urgency).toBe("high");
    expect(help.ttl).toBe(3600);
    expect(help.payload.body).toContain("拠点3");
    expect(buildNotice(MSG.thanksToHelper("花子", "ありがとう", 3, "助かりました", "https://x"), morning).urgency).toBe("low");
  });
  it("本文はあいさつを飛ばし、120字まで", () => {
    const n = buildNotice(MSG.rollcallRequester(12), morning);
    expect(n.payload.body.startsWith("今朝、玄関から外に出られそうですか？")).toBe(true);
    expect(buildNotice([{ type: "text", text: "あ".repeat(300) }], morning).payload.body.length).toBeLessThanOrEqual(120);
  });
  it("夜（22〜6時）は急がない知らせだけ音なし。急ぎ（警報・ヘルプ）は鳴らす", () => {
    expect(quietHours(night)).toBe(true);
    expect(quietHours(morning)).toBe(false);
    expect(buildNotice(MSG.thanksToHelper("花子", "ありがとう", 3, "助かりました", "https://x"), night).payload.silent).toBe(true);
    expect(buildNotice(MSG.stormStop("暴風雪警報", ["a", "b", "c"]), night).payload.silent).toBeUndefined();
    expect(buildNotice(MSG.helpRequest("m1", 3, 1, ["偵察"]), morning).payload.silent).toBeUndefined();
  });
});

describe("送り口", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "");
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("../push/send");
  });
  it("トークでの返事（reply）は端末の通知を鳴らさない。お知らせ（push）は鳴らす", async () => {
    const sendPush = vi.fn(async () => 1);
    vi.doMock("../push/send", () => ({ sendPush }));
    const { push, reply } = await import("../line/client");
    await reply("U-1", [{ type: "text", text: "わかりました" }]);
    expect(sendPush).not.toHaveBeenCalled();
    await push("U-1", MSG.helpRequest("m1", 3, 1, ["偵察"]));
    expect(sendPush).toHaveBeenCalledTimes(1);
    expect(sendPush.mock.calls[0]).toMatchObject(["U-1", { url: "/chat", tag: "help" }, { urgency: "high", ttl: 3600 }]);
  });
});
