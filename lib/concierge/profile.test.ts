import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listThread } from "../inbox/store";
import { memoryRepo } from "../repo";
import type { Participant } from "../types";
import { loadProfile, motivesFromText, tidyMotives, updateProfile } from "./profile";
import { concierge } from "./run";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaConcierge", "__shimaenaInbox", "__shimaenaProfiles", "__shimaenaSoloScores"]) delete (globalThis as Record<string, unknown>)[k];
});
afterEach(() => vi.unstubAllEnvs());

describe("求めている方向（spec v1.17）", () => {
  it("ことばから方向を読む。知らない値は落とす", () => {
    expect(motivesFromText("近所に知り合いがほしい")).toEqual(["connect"]);
    expect(motivesFromText("健康のために体を動かしたい。町の役にも立ちたい")).toEqual(["exercise", "community"]);
    expect(motivesFromText("レアカードがほしい")).toEqual(["game"]);
    expect(motivesFromText("今日は何をすればいい？")).toEqual([]);
    expect(tidyMotives(["game", "nope", "game", 3])).toEqual(["game"]);
  });
  it("新しく読み取れたときだけ入れ替え、空なら前のまま。要約は40字まで", async () => {
    expect(await loadProfile("p-x")).toBeUndefined();
    await updateProfile("p-x", { motives: ["connect"], summary: "仲間がほしい" });
    await updateProfile("p-x", { motives: [], summary: "" });
    expect(await loadProfile("p-x")).toMatchObject({ motives: ["connect"], summary: "仲間がほしい" });
    await updateProfile("p-x", { motives: ["game", "exercise"], summary: "あ".repeat(60) });
    const p = await loadProfile("p-x");
    expect(p?.motives).toEqual(["game", "exercise"]);
    expect(p?.summary).toHaveLength(40);
  });
  it("相談すると方向が残り、次の相談では合う候補が前に出る。理由の1文がカードに付く", async () => {
    const me: Participant = { id: "p-mot", nickname: "もと", role: "helper", location: [43.0401, 141.3699], lineUserId: "U-mot", teamId: "salvia", morningMinutes: 30, hasTools: true };
    await memoryRepo.upsertParticipant(me);
    const now = new Date("2026-12-14T10:00:00+09:00");
    const ms = (await concierge("U-mot", "ひとり暮らしで、雪かきをきっかけに仲間がほしい", now))!;
    expect(JSON.stringify(ms)).toContain("/nakama");
    expect(JSON.stringify(ms)).toContain("💡");
    expect(await loadProfile("p-mot")).toMatchObject({ motives: ["connect"] });
    expect(await listThread("U-mot")).toEqual([]); // concierge は返事を返すだけ（流れに入れるのは呼ぶ側）
  });
});
