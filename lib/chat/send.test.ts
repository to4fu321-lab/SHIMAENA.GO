import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listThread } from "../inbox/store";
import { memoryRepo } from "../repo";
import type { Participant } from "../types";
import { sendToCaptain } from "./send";

const me: Participant = { id: "p-chat", nickname: "話す人", role: "helper", location: [43.0401, 141.3699], lineUserId: "U-chat", teamId: "salvia", morningMinutes: 30, hasTools: true };

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaConcierge", "__shimaenaInbox"]) delete (globalThis as Record<string, unknown>)[k];
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("隊長トークで送る", () => {
  it("文を送ると本人の吹き出しが残り、隊長の返事が同じ流れに入る", async () => {
    await memoryRepo.upsertParticipant(me);
    expect(await sendToCaptain(me, { kind: "text", text: "隊長に相談" })).toBe(true);
    const t = await listThread("U-chat");
    expect(t[0]).toMatchObject({ dir: "in", body: { text: "隊長に相談" } });
    expect(t.length).toBeGreaterThan(1);
    expect(JSON.stringify(t.at(-1)!.body)).toContain("何をすればいい？");
  });
  it("ボタン（postback）は押した文字が本人の吹き出しになり、今までの処理が動く。架空の人は demo: の鍵で", async () => {
    const h3 = (await memoryRepo.findParticipant("h3"))!;
    expect(await sendToCaptain(h3, { kind: "postback", data: "go:no", label: "今朝は行けない" })).toBe(true);
    const t = await listThread("demo:h3");
    expect(t[0]).toMatchObject({ dir: "in", body: { text: "今朝は行けない" } });
    expect(JSON.stringify(t.slice(1).map((x) => x.body))).toMatch(/無理しないで|今朝の割り当てはありません/); // 朝の状態しだい（見本の朝では割り当てなし）
  });
  it("空の文・届け先のない人は何もしない", async () => {
    expect(await sendToCaptain(me, { kind: "text", text: "   " })).toBe(false);
    expect(await sendToCaptain({ ...me, id: "p-proxy", lineUserId: undefined }, { kind: "text", text: "a" })).toBe(false);
  });
});
