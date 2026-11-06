import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockVoice } from "../claude/concierge";
import { mockProposals, tidyProposals } from "../claude/improve";
import { concierge } from "../concierge/run";
import { emptyMorning } from "../morning/flow";
import { saveMorning } from "../morning/store";
import { memoryRepo } from "../repo";
import type { Participant } from "../types";
import { writeImprovements } from "./improve";
import { addVoice, countByCategory, listVoicesBetween, loadLatestImprovement } from "./store";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaConcierge", "__shimaenaInbox", "__shimaenaProfiles", "__shimaenaVoices", "__shimaenaImprove", "__shimaenaSoloScores"]) delete (globalThis as Record<string, unknown>)[k];
});
afterEach(() => vi.unstubAllEnvs());

describe("声を貯める（spec v1.17）", () => {
  it("言葉の一覧で種類を読む。要約は原文を写さない", () => {
    expect(mockVoice("地図に自分の家の写真があったらいい").category).toBe("feature");
    expect(mockVoice("点呼の答え方が分からない").category).toBe("confusion");
    expect(mockVoice("写真を送っても完了にならない").category).toBe("trouble");
    expect(mockVoice("昨日はありがとう、楽しかった").category).toBe("praise");
    expect(mockVoice("今日は晴れ").category).toBe("none");
    expect(mockVoice("写真を送っても完了にならない").text).not.toContain("写真");
  });
  it("相談すると声が1件たまり、原文・名前は残らない。種類ごとの数が数えられる", async () => {
    const me: Participant = { id: "p-v", nickname: "こえ", role: "helper", location: [43.0401, 141.3699], lineUserId: "U-v", teamId: "salvia", morningMinutes: 30, hasTools: true };
    await memoryRepo.upsertParticipant(me);
    await concierge("U-v", "雪かきのあとに銭湯の券がもらえる機能がほしい", new Date("2026-12-14T10:00:00+09:00"));
    await concierge("U-v", "今日は晴れだね", new Date("2026-12-14T10:01:00+09:00"));
    const vs = await listVoicesBetween("2026-12-01", "2026-12-31");
    expect(vs).toHaveLength(1);
    expect(vs[0]).toMatchObject({ participantId: "p-v", category: "feature" });
    expect(vs[0].summary).not.toContain("銭湯");
    expect(JSON.stringify(vs)).not.toContain("こえ");
    expect(countByCategory(vs)).toEqual({ feature: 1, confusion: 0, trouble: 0, praise: 0 });
  });
  it("1週間の声から改善の提案（キーなしは定型）。声がなければ提案なし。提案は点検される", async () => {
    const now = new Date("2026-12-20T12:00:00Z"); // JST 12/20（日）21:00
    await saveMorning(emptyMorning({ date: "2026-12-20", forecastCm: 0 })); // アプリの「今日」を 12/20 に
    expect((await writeImprovements(now)).proposals).toEqual([]);
    await addVoice({ participantId: "a", date: "2026-12-15", category: "confusion", summary: "点呼の答え方", motives: ["connect"] }, now);
    await addVoice({ participantId: "b", date: "2026-12-16", category: "confusion", summary: "地図の見方", motives: ["connect"] }, now);
    await addVoice({ participantId: "c", date: "2026-12-16", category: "feature", summary: "ごほうび", motives: ["game"] }, now);
    const imp = await writeImprovements(now);
    expect(imp.total).toBe(3);
    expect(imp.weekStart).toBe("2026-12-14");
    expect(imp.proposals.length).toBeGreaterThanOrEqual(2);
    expect(imp.proposals[0]).toMatchObject({ voices: 2 });
    expect(imp.byClaude).toBe(false);
    expect((await loadLatestImprovement())?.weekStart).toBe("2026-12-14");
    const tidy = tidyProposals([{ title: "x".repeat(50), voices: 99, change: " y ", where: "w", priority: "超" as never }], { from: "", to: "", total: 3, counts: imp.counts, voices: [] });
    expect(tidy[0]).toMatchObject({ voices: 3, priority: "中", change: "y" });
    expect(tidy[0].title).toHaveLength(30);
    expect(mockProposals({ from: "", to: "", total: 0, counts: { feature: 0, confusion: 0, trouble: 0, praise: 0 }, voices: [] })).toEqual([]);
  });
});
