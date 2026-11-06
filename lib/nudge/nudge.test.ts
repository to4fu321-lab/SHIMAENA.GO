import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockNudge, tidyNudge } from "../claude/nudge";
import { listThread } from "../inbox/store";
import { memoryRepo } from "../repo";
import type { Participant } from "../types";
import { nudgeInactive } from "./ops";
import { INTERVAL_DAYS, QUIET_WORDS, REPEAT_DAYS, shouldNudge, type NudgeState } from "./rules";

const D = (s: string) => new Date(s);
const iso = (s: string) => D(s).toISOString();

describe("隊長の声かけの決まり（spec v1.18）", () => {
  const now = D("2026-12-20T07:00:00Z");
  const fresh: NudgeState = { firstSeen: iso("2026-12-01T00:00:00Z") };
  it("手伝う側だけ。7日以上活動がない人。初出動がない人は、初めて見てから3日たってから", () => {
    expect(shouldNudge({ id: "a", role: "requester", lastActiveAt: iso("2026-12-01T00:00:00Z") }, fresh, now)).toBe(false);
    expect(shouldNudge({ id: "a", role: "helper", lastActiveAt: iso("2026-12-18T00:00:00Z") }, fresh, now)).toBe(false);
    expect(shouldNudge({ id: "a", role: "helper", lastActiveAt: iso("2026-12-10T00:00:00Z") }, fresh, now)).toBe(true);
    expect(shouldNudge({ id: "a", role: "helper" }, { firstSeen: iso("2026-12-19T00:00:00Z") }, now)).toBe(false);
    expect(shouldNudge({ id: "a", role: "helper" }, fresh, now)).toBe(true);
  });
  it("2週間に1回まで。声かけのあとも動いていなければ4週間後。「休む」で1週間黙る。設定で止められる", () => {
    const c = { id: "a", role: "helper" as const, lastActiveAt: iso("2026-11-01T00:00:00Z") };
    const nudged = { ...fresh, lastAt: iso("2026-12-10T00:00:00Z"), activeAtLast: c.lastActiveAt };
    expect(shouldNudge(c, nudged, now)).toBe(false); // 10日しかたっていない（動いていないので 4週間待つ）
    expect(shouldNudge(c, nudged, new Date(Date.parse(nudged.lastAt) + (REPEAT_DAYS - 1) * 86400000))).toBe(false);
    expect(shouldNudge(c, nudged, new Date(Date.parse(nudged.lastAt) + REPEAT_DAYS * 86400000 + 1000))).toBe(true);
    // 声かけのあとに動いた人は、また 7日たって、前の声かけから 2週間たてばよい
    const moved = { ...c, lastActiveAt: iso("2026-12-12T00:00:00Z") };
    expect(shouldNudge(moved, nudged, new Date(Date.parse(nudged.lastAt) + INTERVAL_DAYS * 86400000 + 1000))).toBe(true);
    expect(shouldNudge(c, { ...fresh, skipUntil: iso("2026-12-25T00:00:00Z") }, now)).toBe(false);
    expect(shouldNudge(c, { ...fresh, off: true }, now)).toBe(false);
    expect(QUIET_WORDS.test("今日は休む")).toBe(true);
    expect(QUIET_WORDS.test("いらない")).toBe(true);
    expect(QUIET_WORDS.test("雪かきGO！")).toBe(false);
  });
  it("文は2文・50字・体のことばなし。定型は数字を作らない", () => {
    const i = { nickname: "ゆき", daysSince: 9, motives: ["connect" as const], summary: "", feathers: 12, cards: 2, week: { days: 2, housesDone: 7 }, option: { title: "なかまと10分", minutes: 10, points: 0 } };
    const m = mockNudge(i);
    expect(m).toHaveLength(2);
    expect(m[0]).toContain("2回");
    expect(m[1]).toContain("つながり");
    expect(tidyNudge(["腰は大丈夫ですか？", "x".repeat(80), "三文目"], i)).toEqual(["x".repeat(50), "三文目"]);
    expect(tidyNudge(["腰は大丈夫ですか？"], i)).toEqual(m);
  });
});

describe("声かけを送る", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "");
    for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaInbox", "__shimaenaNudge", "__shimaenaProfiles", "__shimaenaArchive", "__shimaenaSoloScores"]) delete (globalThis as Record<string, unknown>)[k];
  });
  afterEach(() => vi.unstubAllEnvs());
  it("活動のない手伝う側の隊長トークに、2文と候補のボタンが届く。同じ日に2回は送らない。夜は送らない", async () => {
    const me: Participant = { id: "p-idle", nickname: "のんびり", role: "helper", location: [43.0401, 141.3699], lineUserId: "U-idle", teamId: "salvia", morningMinutes: 30, hasTools: true };
    await memoryRepo.upsertParticipant(me);
    const night = await nudgeInactive(D("2026-12-20T12:00:00Z")); // JST 21:00
    expect(night.sent).toBe(0);
    const first = await nudgeInactive(D("2026-12-20T07:30:00Z")); // 初めて見た日: 3日たっていないので送らない
    expect(first.sent).toBe(0);
    const later = await nudgeInactive(D("2026-12-24T07:30:00Z"));
    expect(later.names).toContain("のんびり");
    const t = await listThread("U-idle");
    expect(t.length).toBeGreaterThan(0);
    expect(JSON.stringify(t.at(-1)!.body)).toContain("you.png");
    expect((await nudgeInactive(D("2026-12-24T08:30:00Z"))).sent).toBe(0);
  });
});
