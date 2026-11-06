import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MSG } from "../line/messages";
import { pushPayload, sendPush } from "./send";
import { countSubscriptions, isSubscriptionJson, listSubscriptions, removeSubscription, saveSubscription } from "./store";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  delete (globalThis as Record<string, unknown>).__shimaenaPush;
});
afterEach(() => vi.unstubAllEnvs());

const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: "p", auth: "a" } });

describe("端末への通知", () => {
  it("通知の中身: 点呼は題名「今朝の点呼」で本文は質問（あいさつは飛ばす）。画像だけなら「カードが届きました」", () => {
    const p = pushPayload(MSG.rollcallHelper(12, "わた雪"), new Date("2026-12-14T06:30:00+09:00"));
    expect(p.title).toContain("今朝の点呼");
    expect(p.body.startsWith("今日、いつ手伝えそうですか？")).toBe(true);
    expect(p.url).toBe("/chat");
    expect(pushPayload([{ type: "image", originalContentUrl: "x", previewImageUrl: "x" }]).body).toBe("カードが届きました");
    expect(pushPayload([{ type: "text", text: "a".repeat(300) }]).body.length).toBeLessThanOrEqual(130);
  });
  it("購読は端末ごとに1行。同じ端末は上書き。人数と端末の数が数えられる。形がおかしいものは受け付けない", async () => {
    expect(isSubscriptionJson(sub("https://push.example/1"))).toBe(true);
    expect(isSubscriptionJson({ endpoint: "http://x", keys: { p256dh: "p", auth: "a" } })).toBe(false);
    expect(isSubscriptionJson({ endpoint: "https://x" })).toBe(false);
    await saveSubscription("U-1", sub("https://push.example/1"), "iPhone");
    await saveSubscription("U-1", sub("https://push.example/1"), "iPhone");
    await saveSubscription("U-1", sub("https://push.example/2"));
    await saveSubscription("U-2", sub("https://push.example/3"));
    expect((await listSubscriptions("U-1")).map((x) => x.endpoint)).toEqual(["https://push.example/1", "https://push.example/2"]);
    expect(await countSubscriptions()).toEqual({ devices: 3, people: 2 });
    await removeSubscription("https://push.example/1");
    expect(await countSubscriptions()).toEqual({ devices: 2, people: 2 });
  });
  it("鍵がない間は送らない（0）", async () => {
    vi.stubEnv("VAPID_PUBLIC_KEY", "");
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    await saveSubscription("U-1", sub("https://push.example/1"));
    expect(await sendPush("U-1", { title: "t", body: "b", url: "/chat" })).toBe(0);
  });
});
