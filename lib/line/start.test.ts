import { beforeEach, describe, expect, it, vi } from "vitest";

// 画面の登録（spec v1.17）: 誰の登録かは cookie（登録前の印）で決める
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
    set: (k: string, v: string) => void jar.set(k, v),
    delete: (k: string) => void jar.delete(k),
  }),
}));

import { registerAction, linkCodeAction } from "@/app/start/actions";
import { PENDING_COOKIE, readPending, signPending } from "../auth/pending";
import { memoryRepo } from "../repo";
import { readViewer, VIEWER_COOKIE } from "../viewer";

describe("はじめる（/start の登録）", () => {
  beforeEach(() => {
    for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaInbox"]) delete (globalThis as Record<string, unknown>)[k];
    jar.clear();
    jar.set(PENDING_COOKIE, signPending({ lineUserId: "U-new", displayName: "ゆき" }));
  });

  it("登録前の印は署名つきで、期限が切れたら読めない", () => {
    const v = signPending({ lineUserId: "U-x", displayName: "x" }, new Date("2026-01-01T00:00:00Z"));
    expect(readPending(v, new Date("2026-01-02T00:00:00Z"))).toMatchObject({ lineUserId: "U-x" });
    expect(readPending(v, new Date("2026-02-01T00:00:00Z"))).toBeUndefined();
    expect(readPending(v.slice(0, -2) + "zz")).toBeUndefined();
  });

  it("手伝う側: LINE の名前で登録され、チームに入り、この画面の自分になる", async () => {
    const r = await registerAction({ role: "helper", location: [43.04, 141.37], q1: "30", q2: "yes" });
    expect(r.ok).toBe(true);
    const p = await memoryRepo.findParticipantByLineUserId("U-new");
    expect(p).toMatchObject({ nickname: "ゆき", role: "helper", morningMinutes: 30, hasTools: true });
    expect(p?.teamId).toBeTruthy();
    expect(readViewer(jar.get(VIEWER_COOKIE))).toBe(p?.id);
    expect(jar.has(PENDING_COOKIE)).toBe(false);
  });

  it("お願いする側: 家のレベルと地図の番号ができ、チームにも入る（お互いさま）", async () => {
    const r = await registerAction({ role: "requester", location: [43.04, 141.37], q1: "omakase", q2: "road" });
    expect(r.ok).toBe(true);
    const p = (await memoryRepo.findParticipantByLineUserId("U-new"))!;
    expect(p.helpStyle).toBe("omakase"); // 頼み方（spec v1.20）
    expect(p.level).toBeGreaterThanOrEqual(1);
    expect(await memoryRepo.findBaseByRequester(p.id)).toBeTruthy();
    expect(p.teamId).toBeTruthy();
  });

  it("家族の代わり: 本人の家が登録され、連携コードが出る。本人がコードを入れると本人の LINE が紐づく", async () => {
    const r = await registerAction({ role: "family", location: [43.04, 141.37], q1: "together", q2: "entrance" });
    expect(r.ok).toBe(true);
    expect(r.linkCode).toMatch(/^\d{6}$/);
    expect(await memoryRepo.findParticipantByLineUserId("U-new")).toBeUndefined(); // 家族本人は参加者ではない
    // 本人が別の LINE でログインして、コードを入れる
    jar.set(PENDING_COOKIE, signPending({ lineUserId: "U-parent", displayName: "ひまわり" }));
    const l = await linkCodeAction(r.linkCode!, "self");
    expect(l.ok).toBe(true);
    const parent = await memoryRepo.findParticipantByLineUserId("U-parent");
    expect(parent?.role).toBe("requester");
    expect(readViewer(jar.get(VIEWER_COOKIE))).toBe(parent?.id);
    expect((await linkCodeAction("000000", "family")).ok).toBe(false);
  });

  it("ログインの印がない・答えが足りないときは登録しない", async () => {
    expect((await registerAction({ role: "helper", location: [43.04, 141.37], q1: "99", q2: "yes" })).ok).toBe(false);
    expect((await registerAction({ role: "helper", location: [NaN, 1], q1: "30", q2: "yes" })).ok).toBe(false);
    jar.clear();
    expect((await registerAction({ role: "helper", location: [43.04, 141.37], q1: "30", q2: "yes" })).ok).toBe(false);
    expect(await memoryRepo.findParticipantByLineUserId("U-new")).toBeUndefined();
  });
});
