import { describe, expect, it } from "vitest";
import { assignTeam, makeLinkCode } from "../game/team";
import { memoryRepo } from "../repo";
import { finishRegistration, handleEvent, toInput } from "./handle";
import { parseText, step, type RegSession } from "./registration";
import { signBody, verifySignature } from "./signature";
import type { LineEvent, TextMessage } from "./types";

describe("署名検証", () => {
  const secret = "test-secret";
  const body = JSON.stringify({ events: [{ type: "follow" }] });

  it("正しい署名なら通る", () => {
    expect(verifySignature(body, signBody(body, secret), secret)).toBe(true);
  });
  it("本文が1文字でも違えば通らない", () => {
    expect(verifySignature(body + " ", signBody(body, secret), secret)).toBe(false);
  });
  it("別の secret・署名なし・長さ違いは通らない", () => {
    expect(verifySignature(body, signBody(body, "other"), secret)).toBe(false);
    expect(verifySignature(body, null, secret)).toBe(false);
    expect(verifySignature(body, "abc", secret)).toBe(false);
  });
});

describe("文字の読み取り", () => {
  it("「登録」「設定」はやり直し、6桁は連携コード、それ以外は文字", () => {
    expect(parseText("登録")).toEqual({ kind: "restart" });
    expect(parseText(" 設定 ")).toEqual({ kind: "restart" });
    expect(parseText("123456")).toEqual({ kind: "code", code: "123456" });
    expect(parseText("連携 123456")).toEqual({ kind: "code", code: "123456" });
    expect(parseText("こんにちは")).toEqual({ kind: "text", text: "こんにちは" });
    expect(parseText("12345")).toEqual({ kind: "text", text: "12345" });
  });
});

const labels = (m: TextMessage) => m.quickReply?.items.map((i) => i.action.label) ?? [];

describe("登録の会話（純粋な関数）", () => {
  it("手伝う側: 友だち追加 → 役割 → 位置 → 2問 → 完了", () => {
    let out = step(undefined, { kind: "follow" });
    expect(out.session?.step).toBe("role");
    expect(labels(out.messages[0] as TextMessage)).toEqual(["雪かきをお願いしたい", "雪かきを手伝う", "家族の代わりに登録"]);

    out = step(out.session!, { kind: "postback", data: "reg:role=helper" });
    expect(out.session).toMatchObject({ step: "location", role: "helper", proxy: false });
    expect((out.messages[0] as TextMessage).quickReply?.items[0].action.type).toBe("location");

    out = step(out.session!, { kind: "location", location: [43.04, 141.37] });
    expect(out.session?.step).toBe("q1");
    expect(labels(out.messages[0] as TextMessage)).toEqual(["15分", "30分", "60分"]);

    out = step(out.session!, { kind: "postback", data: "reg:q1=30" });
    expect(out.session?.step).toBe("q2");
    expect(labels(out.messages[0] as TextMessage)).toEqual(["ある", "ない"]);

    out = step(out.session!, { kind: "postback", data: "reg:q2=yes" });
    expect(out.session).toBeNull();
    expect(out.done).toEqual({ role: "helper", location: [43.04, 141.37], morningMinutes: 30, hasTools: true });
  });

  it("依頼者: 2問の選択肢が違い、答えがそのまま残る", () => {
    let out = step({ step: "role" }, { kind: "postback", data: "reg:role=requester" });
    out = step(out.session!, { kind: "location", location: [43.041, 141.371] });
    expect(labels(out.messages[0] as TextMessage)).toEqual(["15分くらい", "30分くらい", "60分以上", "わからない"]);
    out = step(out.session!, { kind: "postback", data: "reg:q1=unknown" });
    expect(labels(out.messages[0] as TextMessage)).toEqual(["玄関前まで", "車庫前まで", "道路まで"]);
    out = step(out.session!, { kind: "postback", data: "reg:q2=road" });
    expect(out.done).toEqual({
      role: "requester",
      proxy: false,
      location: [43.041, 141.371],
      soloMinutes: "unknown",
      clearArea: "road",
    });
  });

  it("家族の代理登録: 依頼者の質問になり、proxy が付く", () => {
    let out = step({ step: "role" }, { kind: "postback", data: "reg:role=family" });
    expect(out.session).toMatchObject({ step: "location", role: "requester", proxy: true });
    expect((out.messages[0] as TextMessage).text).toContain("ご家族");
    out = step(out.session!, { kind: "location", location: [43.04, 141.37] });
    out = step(out.session!, { kind: "postback", data: "reg:q1=60" });
    out = step(out.session!, { kind: "postback", data: "reg:q2=garage" });
    expect(out.done).toMatchObject({ role: "requester", proxy: true, soloMinutes: 60, clearArea: "garage" });
  });

  it("段階に合わない入力は、いまの質問をもう一度出す", () => {
    const s: RegSession = { step: "q1", role: "helper", proxy: false, location: [1, 2] };
    const byText = step(s, { kind: "text", text: "はい" });
    expect(byText.session).toEqual(s);
    expect(labels(byText.messages[0] as TextMessage)).toEqual(["15分", "30分", "60分"]);
    const byOldButton = step(s, { kind: "postback", data: "reg:role=helper" });
    expect(byOldButton.session).toEqual(s);
    const wrongValue = step(s, { kind: "postback", data: "reg:q1=999" });
    expect(wrongValue.session).toEqual(s);
  });

  it("途中でも「登録」でやり直せる。登録中でない人の文字には案内だけ", () => {
    const restart = step({ step: "q2", role: "helper", location: [1, 2], q1: "15" }, { kind: "restart" });
    expect(restart.session).toEqual({ step: "role" });
    const idle = step(undefined, { kind: "text", text: "おはよう" });
    expect(idle.session).toBeNull();
    expect((idle.messages[0] as TextMessage).text).toContain("登録");
    expect(step(undefined, { kind: "location", location: [1, 2] }).messages).toEqual([]);
  });

  it("連携コード → 本人か家族かを聞く → 決まる", () => {
    let out = step(undefined, { kind: "code", code: "123456" });
    expect(out.session).toEqual({ step: "linkWho", linkCode: "123456" });
    expect(labels(out.messages[0] as TextMessage)).toEqual(["雪かきをお願いする本人", "家族（お知らせを受け取る）"]);
    out = step(out.session!, { kind: "postback", data: "link:who=self" });
    expect(out.session).toBeNull();
    expect(out.link).toEqual({ code: "123456", who: "self" });
  });
});

describe("チーム配属と連携コード", () => {
  it("人数が少ないチームに入る。同数なら乱数で選ぶ", () => {
    expect(assignTeam({ salvia: 3, marigold: 1, lupinus: 2 })).toBe("marigold");
    expect(assignTeam({ salvia: 1, marigold: 1, lupinus: 2 }, () => 0)).toBe("salvia");
    expect(assignTeam({ salvia: 1, marigold: 1, lupinus: 2 }, () => 0.99)).toBe("marigold");
  });
  it("連携コードは6桁の数字", () => {
    expect(makeLinkCode(() => 0)).toBe("000000");
    expect(makeLinkCode(() => 0.123456)).toBe("123456");
    expect(makeLinkCode()).toMatch(/^\d{6}$/);
  });
});

describe("Webhook の処理（メモリ保存・LINE には送らない）", () => {
  const ev = (userId: string, rest: Record<string, unknown>): LineEvent =>
    ({ replyToken: "rt", source: { type: "user", userId }, timestamp: 0, ...rest }) as LineEvent;
  const postback = (userId: string, data: string) => ev(userId, { type: "postback", postback: { data } });
  const location = (userId: string, lat: number, lng: number) =>
    ev(userId, { type: "message", message: { id: "1", type: "location", latitude: lat, longitude: lng } });
  const text = (userId: string, t: string) => ev(userId, { type: "message", message: { id: "2", type: "text", text: t } });

  it("イベントを会話の入力に直す", () => {
    expect(toInput(ev("u", { type: "follow" }))).toEqual({ kind: "follow" });
    expect(toInput(text("u", "登録"))).toEqual({ kind: "restart" });
    expect(toInput(location("u", 1, 2))).toEqual({ kind: "location", location: [1, 2] });
    expect(toInput(ev("u", { type: "message", message: { id: "3", type: "sticker" } }))).toBeNull();
    expect(toInput(ev("u", { type: "join" }))).toBeNull();
  });

  it("手伝う側が最後まで登録すると、チーム付きで保存される", async () => {
    const u = "U-helper-1";
    await handleEvent(ev(u, { type: "follow" }));
    await handleEvent(postback(u, "reg:role=helper"));
    await handleEvent(location(u, 43.04, 141.37));
    await handleEvent(postback(u, "reg:q1=15"));
    await handleEvent(postback(u, "reg:q2=no"));
    const p = await memoryRepo.findParticipantByLineUserId(u);
    expect(p).toMatchObject({ role: "helper", morningMinutes: 15, hasTools: false, location: [43.04, 141.37] });
    expect(["salvia", "marigold", "lupinus"]).toContain(p?.teamId);
    expect(await memoryRepo.getSession(u)).toBeUndefined();

    // もう一度登録してもチームは変わらない（毎週のシャッフルで変える）
    const before = p!.teamId;
    await handleEvent(text(u, "登録"));
    await handleEvent(postback(u, "reg:role=helper"));
    await handleEvent(location(u, 43.04, 141.37));
    await handleEvent(postback(u, "reg:q1=60"));
    await handleEvent(postback(u, "reg:q2=yes"));
    const again = await memoryRepo.findParticipantByLineUserId(u);
    expect(again?.id).toBe(p?.id);
    expect(again?.teamId).toBe(before);
    expect(again?.morningMinutes).toBe(60);
  });

  it("依頼者はレベルが付き、拠点の番号をもらう", async () => {
    const u = "U-req-1";
    const msgs = await finishRegistration(u, {
      role: "requester",
      proxy: false,
      location: [43.0405, 141.3705],
      soloMinutes: 60,
      clearArea: "road",
    });
    expect((msgs[0] as TextMessage).text).toContain("家のレベル: 3");
    const p = await memoryRepo.findParticipantByLineUserId(u);
    expect(p).toMatchObject({ role: "requester", level: 3, soloMinutes: 60, clearArea: "road" });
    const base = await memoryRepo.findBaseByRequester(p!.id);
    expect(base?.number).toBeGreaterThan(8); // 架空の8軒の次
  });

  it("家族の代理登録 → 連携コード → 本人が送ると本人の LINE が紐づく → 別の家族も紐づく", async () => {
    const family = "U-family-1";
    const msgs = await finishRegistration(family, {
      role: "requester",
      proxy: true,
      location: [43.0401, 141.3701],
      soloMinutes: 30,
      clearArea: "entrance",
    });
    const code = /連携コード: (\d{6})/.exec((msgs[1] as TextMessage).text)?.[1];
    expect(code).toMatch(/^\d{6}$/);
    const link = await memoryRepo.findFamilyLinkByCode(code!);
    expect(link?.familyLineUserId).toBe(family);
    const requester = await memoryRepo.findParticipant(link!.requesterId);
    expect(requester?.lineUserId).toBeUndefined();
    expect(requester?.registeredByFamilyId).toBe(family);

    const parent = "U-parent-1";
    await handleEvent(text(parent, code!));
    expect(await memoryRepo.getSession(parent)).toEqual({ step: "linkWho", linkCode: code });
    await handleEvent(postback(parent, "link:who=self"));
    expect((await memoryRepo.findParticipant(link!.requesterId))?.lineUserId).toBe(parent);

    const sister = "U-family-2";
    await handleEvent(text(sister, `連携 ${code}`));
    await handleEvent(postback(sister, "link:who=family"));
    const sisterLink = await memoryRepo.findFamilyLinkByCode(
      (await memoryRepo.findFamilyLinkByCode(code!))!.linkCode, // 元のコードはそのまま残る
    );
    expect(sisterLink?.familyLineUserId).toBe(family);
    const all = await Promise.all([memoryRepo.findParticipantByLineUserId(sister)]);
    expect(all[0]).toBeUndefined(); // 家族は参加者にはならない

    // 知らない番号は見つからない、で終わる（途中経過は作らない）
    await handleEvent(text("U-x", "000001"));
    expect(await memoryRepo.getSession("U-x")).toBeUndefined();
  });
});
