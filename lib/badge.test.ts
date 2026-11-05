import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PASSWORDS, passwordOf, visitNoticeLines } from "./badge";
import { MSG } from "./line/messages";
import { placeCard, actionsOf } from "./line/flex";
import { memoryRepo } from "./repo";
import { DEMO_DATE, fillAnswers } from "./morning/flow";
import { announce, plan, ring, setGoing } from "./morning/ops";
import { loadMorning, saveMorning } from "./morning/store";
import { loadRoster } from "./morning/roster";

describe("今日の合言葉（spec v1.12）", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("同じ日は同じ言葉、日が変われば変わることがある。いつも一覧の中から", () => {
    expect(passwordOf("2026-12-14")).toBe(passwordOf("2026-12-14"));
    const week = ["2026-12-14", "2026-12-15", "2026-12-16", "2026-12-17", "2026-12-18", "2026-12-19", "2026-12-20"].map(passwordOf);
    expect(new Set(week).size).toBeGreaterThan(1);
    for (const w of week) expect(PASSWORDS).toContain(w);
  });

  it("鍵が変われば言葉も変わる（公開リポジトリから当てられない）", () => {
    const days = Array.from({ length: 10 }, (_, i) => `2026-12-${String(10 + i).padStart(2, "0")}`);
    const a = days.map(passwordOf);
    vi.stubEnv("LINE_CHANNEL_SECRET", "another-secret");
    expect(days.map(passwordOf)).not.toEqual(a);
  });

  it("公開環境で鍵がないときは作らない", () => {
    vi.stubEnv("LINE_CHANNEL_SECRET", "");
    vi.stubEnv("VERCEL", "1");
    expect(passwordOf("2026-12-14")).toBeUndefined();
    expect(visitNoticeLines("青のサルビアチーム", undefined, false).join("")).not.toContain("合言葉「");
  });

  it("お知らせは、玄関を開けなくてよい・お金はかからない・ちがう人の相談先を伝える", () => {
    const lines = visitNoticeLines("青のサルビアチーム", "こなゆき", true).join("\n");
    expect(lines).toContain("ご家族の家");
    expect(lines).toContain("「こなゆき」");
    expect(lines).toContain("玄関は開けなくて大丈夫");
    expect(lines).toContain("お金は一切かかりません");
    expect(lines).toContain("#9110");
    expect(lines).not.toMatch(/鍵を開け/);
  });

  it("行き先カードに「雪かき中の印」のボタン。依頼者への文に「鍵を開けて」はない", () => {
    const card = placeCard({ time: "now", baseNumber: 3, note: "玄関前", mapUrl: "https://x/map", badgeUrl: "https://x/badge" });
    expect(actionsOf(card).some((a) => "uri" in a && a.uri === "https://x/badge")).toBe(true);
    const text = JSON.stringify([MSG.planForRequester("7:00", ["ゴー子"]), MSG.helpJoined(3)]);
    expect(text).not.toContain("鍵を開け");
    expect(text).toContain("/badge");
  });
});

describe("来る人のお知らせは1軒1回だけ", () => {
  beforeEach(() => {
    const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(`${day}T10:00:00+09:00`) });
  });
  afterEach(() => vi.useRealTimers());

  it("最初の「行く」で記録され、2回目は送らない", async () => {
    await memoryRepo.upsertParticipant({
      id: "p-badge",
      nickname: "バッジ",
      role: "helper",
      location: [43.0403, 141.3703],
      lineUserId: "U-badge",
      teamId: "salvia",
      morningMinutes: 60,
      hasTools: true,
    });
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    const s0 = await loadMorning();
    fillAnswers(s0, await loadRoster(), 3);
    s0.answers.push({ rollcallId: s0.morning.rollcall.id, participantId: "p-badge", answer: 60, answeredAt: "2026-12-14T06:31:00+09:00" });
    await saveMorning(s0);
    await plan();

    const s = await loadMorning();
    const mine = s.morning.sorties.find((x) => x.participantId === "p-badge");
    expect(mine).toBeDefined();
    await setGoing("p-badge", true);
    const after = await loadMorning();
    const mission = after.morning.missions.find((m) => m.id === mine!.missionId)!;
    expect(mission.visitNoticeAt).toBeTruthy();
    const count = () => after.log.filter((l) => l.includes("来る人のお知らせ")).length;
    const first = count();
    expect(first).toBe(1);

    await setGoing("p-badge", true);
    const again = await loadMorning();
    expect(again.morning.missions.find((m) => m.id === mission.id)!.visitNoticeAt).toBe(mission.visitNoticeAt);
    expect(again.log.filter((l) => l.includes("来る人のお知らせ")).length).toBe(1);
  });
});
