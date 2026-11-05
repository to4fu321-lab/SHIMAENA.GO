import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {} }) }));
vi.mock("@/lib/line/client", async (orig) => ({
  ...(await orig<typeof import("./client")>()),
  getProfileByAccessToken: async (t: string) => (t === "good" ? { userId: "U-new", displayName: "ゆき" } : undefined),
  push: async () => true,
}));

import { registerWithLiff } from "@/app/start/actions";
import { memoryRepo } from "../repo";

describe("LINE で1タップ開始（/start の登録）", () => {
  beforeEach(() => {
    for (const k of ["__shimaenaRepo", "__shimaenaMorning"]) delete (globalThis as Record<string, unknown>)[k];
  });

  it("手伝う側: LINE の名前で登録され、チームに入る", async () => {
    const r = await registerWithLiff("good", { role: "helper", location: [43.04, 141.37], q1: "30", q2: "yes" });
    expect(r.ok).toBe(true);
    const p = await memoryRepo.findParticipantByLineUserId("U-new");
    expect(p).toMatchObject({ nickname: "ゆき", role: "helper", morningMinutes: 30, hasTools: true });
    expect(p?.teamId).toBeTruthy();
  });

  it("お願いする側: 家のレベルと地図の番号ができ、チームにも入る（お互いさま）", async () => {
    const r = await registerWithLiff("good", { role: "requester", location: [43.04, 141.37], q1: "60", q2: "road" });
    expect(r.ok).toBe(true);
    const p = (await memoryRepo.findParticipantByLineUserId("U-new"))!;
    expect(p.level).toBeGreaterThanOrEqual(1);
    expect(await memoryRepo.findBaseByRequester(p.id)).toBeTruthy();
    expect(p.teamId).toBeTruthy();
  });

  it("LINE で確かめられない・答えが足りないときは登録しない", async () => {
    expect((await registerWithLiff("bad", { role: "helper", location: [43.04, 141.37], q1: "30", q2: "yes" })).ok).toBe(false);
    expect((await registerWithLiff("good", { role: "helper", location: [43.04, 141.37], q1: "99", q2: "yes" })).ok).toBe(false);
    expect((await registerWithLiff("good", { role: "helper", location: [NaN, 1], q1: "30", q2: "yes" })).ok).toBe(false);
    expect(await memoryRepo.findParticipantByLineUserId("U-new")).toBeUndefined();
  });
});
