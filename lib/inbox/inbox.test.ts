import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoParticipantId, inboxKeyOf } from "./key";
import { appendIn, appendOut, countOutSince, listThread, markRead, unreadCount } from "./store";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  delete (globalThis as Record<string, unknown>).__shimaenaInbox;
});
afterEach(() => vi.unstubAllEnvs());

describe("隊長トークの鍵", () => {
  it("本物の人は LINE のアカウント ID、架空の人は demo:<ID>、どちらもない人は届け先なし", () => {
    expect(inboxKeyOf({ id: "p-abc", lineUserId: "U-1" })).toBe("U-1");
    expect(inboxKeyOf({ id: "h3" })).toBe("demo:h3");
    expect(inboxKeyOf({ id: "r2" })).toBe("demo:r2");
    expect(inboxKeyOf({ id: "p-proxy" })).toBeUndefined();
    expect(inboxKeyOf(undefined)).toBeUndefined();
    expect(demoParticipantId("demo:h3")).toBe("h3");
    expect(demoParticipantId("U-1")).toBeUndefined();
    expect(demoParticipantId("demo:p-xyz")).toBeUndefined();
  });
  it("本当にエリアで使うとき（DEMO_MODE=off）は、架空の人には届けない", () => {
    vi.stubEnv("DEMO_MODE", "off");
    expect(inboxKeyOf({ id: "h3" })).toBeUndefined();
    expect(demoParticipantId("demo:h3")).toBeUndefined();
  });
});

describe("隊長トークの流れ", () => {
  it("隊長の文面と本人の文が、古い順に1つの流れになる。未読は隊長の行だけ数え、開いたら 0 に", async () => {
    await appendOut("U-1", [{ type: "text", text: "おはよう" }, { type: "text", text: "今朝は雪12cm" }], new Date("2026-12-01T00:00:00Z"));
    await appendIn("U-1", { text: "行けます" }, new Date("2026-12-01T00:01:00Z"));
    await appendOut("U-1", [{ type: "text", text: "ありがとう！" }], new Date("2026-12-01T00:02:00Z"));
    await appendOut("U-2", [{ type: "text", text: "別の人" }], new Date("2026-12-01T00:03:00Z"));
    const t = await listThread("U-1");
    expect(t.map((x) => x.dir)).toEqual(["out", "out", "in", "out"]);
    expect(t[2].body).toEqual({ text: "行けます" });
    expect(await unreadCount("U-1")).toBe(3);
    await markRead("U-1");
    expect(await unreadCount("U-1")).toBe(0);
    expect(await unreadCount("U-2")).toBe(1);
    expect(await countOutSince("2026-12-01T00:01:30Z")).toBe(2);
  });
  it("流れは最新の limit 件だけ", async () => {
    await appendOut("U-3", Array.from({ length: 5 }, (_, i) => ({ type: "text" as const, text: `m${i}` })));
    const t = await listThread("U-3", 2);
    expect(t.map((x) => (x.body as { text: string }).text)).toEqual(["m3", "m4"]);
  });
});
