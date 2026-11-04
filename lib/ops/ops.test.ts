// 11/4 精査 P0: 送信の失敗で止まらない・同じイベントを2回処理しない・状態を1つずつ書き換える・公開環境での逃げ道をふさぐ
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("LINE の送信", () => {
  it("LINE が失敗を返しても例外にせず false、問題として残る。次の人には送り続ける", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "test-token");
    vi.stubEnv("LINE_DRY_RUN", "");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: RequestInit) => {
        const to = JSON.parse(String(init.body)).to as string;
        calls.push(to);
        return to === "U-bad" ? new Response("月の上限です", { status: 429 }) : new Response("{}", { status: 200 });
      }),
    );
    const { push } = await import("../line/client");
    const { listProblems } = await import("./problems");
    const results = [];
    for (const to of ["U-1", "U-bad", "U-3"]) results.push(await push(to, [{ type: "text", text: "おはよう" }]));
    expect(results).toEqual([true, false, true]);
    expect(calls).toEqual(["U-1", "U-bad", "U-3"]);
    expect((await listProblems())[0]).toMatchObject({ where: "line/message/push" });
    expect((await listProblems())[0].message).toContain("429");
  });

  it("LINE_DRY_RUN=1 なら送らずに数えるだけ（検証で月の通数を使わない）", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("LINE_CHANNEL_ACCESS_TOKEN", "test-token");
    vi.stubEnv("LINE_DRY_RUN", "1");
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { multicast } = await import("../line/client");
    const { readLineUsage } = await import("./line-usage");
    const before = await readLineUsage();
    expect(await multicast(["U-1", "U-2", "U-3"], [{ type: "text", text: "点呼" }])).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    const after = await readLineUsage();
    expect(after.dryRun - before.dryRun).toBe(3);
    expect(after.sent).toBe(before.sent);
  });
});

describe("同じイベントを2回処理しない", () => {
  it("同じ webhookEventId は1回だけ。ID がない古い形は毎回処理する", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { firstTime } = await import("./once");
    expect(await firstTime("ev-1")).toBe(true);
    expect(await firstTime("ev-1")).toBe(false);
    expect(await firstTime("ev-2")).toBe(true);
    expect(await firstTime(undefined)).toBe(true);
    expect(await firstTime(undefined)).toBe(true);
  });
});

describe("今朝の状態を1つずつ書き換える", () => {
  it("同時に来た2つの書き換えが、両方とも残る", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { withStateLock } = await import("./lock");
    const box = { n: 0, log: [] as string[] };
    const slowIncrement = (who: string) =>
      withStateLock(who, async () => {
        const read = box.n; // 読む
        await new Promise((r) => setTimeout(r, 20)); // その間にもう1人が来る
        box.n = read + 1; // 書き換えて保存
        box.log.push(who);
      });
    await Promise.all([slowIncrement("A"), slowIncrement("B")]);
    expect(box.n).toBe(2);
    expect(box.log).toEqual(["A", "B"]);
  });

  it("中でもう一度呼んでも待ち続けない", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { withStateLock } = await import("./lock");
    const out = await withStateLock("outer", () => withStateLock("inner", async () => "ok"));
    expect(out).toBe("ok");
  });

  it("失敗しても次の人は動ける", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { withStateLock } = await import("./lock");
    await expect(withStateLock("bad", async () => Promise.reject(new Error("だめ")))).rejects.toThrow("だめ");
    expect(await withStateLock("next", async () => 1)).toBe(1);
  });
});

describe("Webhook のイベント処理", () => {
  it("送り直し（同じ ID）は1回、1件の失敗で他を止めない", async () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const handled: string[] = [];
    vi.doMock("../line/handle", () => ({
      handleEvent: async (ev: { webhookEventId?: string; type: string }) => {
        if (ev.type === "boom") throw new Error("こわれた");
        handled.push(ev.webhookEventId ?? "?");
      },
    }));
    const { processEvents } = await import("../line/process");
    const base = { source: { type: "user" as const, userId: "U1" }, timestamp: 0 };
    const n = await processEvents([
      { ...base, type: "follow", replyToken: "r", webhookEventId: "w-1" },
      { ...base, type: "boom", webhookEventId: "w-2" },
      { ...base, type: "follow", replyToken: "r", webhookEventId: "w-1", deliveryContext: { isRedelivery: true } },
      { ...base, type: "follow", replyToken: "r", webhookEventId: "w-3" },
    ]);
    expect(handled).toEqual(["w-1", "w-3"]);
    expect(n).toBe(2);
    vi.doUnmock("../line/handle");
  });
});

describe("公開環境の逃げ道をふさぐ", () => {
  it("公開環境で LINE_CHANNEL_SECRET がなければ、仮の鍵で本人の印を作らない", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("LINE_CHANNEL_SECRET", "");
    const { readViewer, signViewer } = await import("../viewer");
    expect(() => signViewer("p-abc")).toThrow();
    // 手元の仮の鍵で作った印は、公開環境では通らない
    vi.stubEnv("VERCEL", "");
    const forged = signViewer("p-abc");
    vi.stubEnv("VERCEL", "1");
    expect(readViewer(forged)).toBeUndefined();
  });

  it("DEMO_MODE=off で架空の人として押せない（既定はオン）", async () => {
    const { demoEnabled } = await import("../env");
    expect(demoEnabled()).toBe(true);
    vi.stubEnv("DEMO_MODE", "off");
    expect(demoEnabled()).toBe(false);
  });

  it("公開環境では DB に保存できないとき、メモリに逃げずに失敗を返す", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("DATABASE_URL", "postgres://user:pass@127.0.0.1:1/none");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.doMock("../db", async (orig) => ({
      ...(await orig<typeof import("../db")>()),
      query: async () => {
        throw new Error("DB につながりません");
      },
    }));
    const { loadMorning } = await import("../morning/store");
    await expect(loadMorning()).rejects.toThrow("DB につながりません");
    vi.doUnmock("../db");
  });
});
