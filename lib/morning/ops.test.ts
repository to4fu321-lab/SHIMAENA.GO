import { describe, expect, it } from "vitest";
import { memoryRepo } from "../repo";
import type { TextMessage } from "../line/types";
import { jstDate } from "../jst";
import { DEMO_DATE, fillAnswers } from "./flow";
import { announce, answerRollcall, plan, planIfDue, ring } from "./ops";
import { TOWN_ROSTER } from "./roster";
import { loadMorning, saveMorning } from "./store";

const t = (m: { type: string }) => (m as TextMessage).text;

describe("朝の本番の操作（メモリ保存・LINE には送らない）", () => {
  it("予告 → 点呼 → LINE の答え → 作戦、が通る", async () => {
    await memoryRepo.upsertParticipant({
      id: "p-real",
      nickname: "テスト太郎",
      role: "helper",
      location: [43.0402, 141.3702],
      lineUserId: "U-real",
      teamId: "lupinus",
      morningMinutes: 30,
      hasTools: true,
    });

    const announced = await announce({ date: DEMO_DATE, forecastCm: 12 });
    expect(announced.morning.rollcall.status).toBe("announced");
    expect(announced.briefing).toContain("12cm");
    expect(announced.log.at(-1)).toContain("予告を LINE で 1 人に送信");

    // 点呼の前に答えても受け付けない
    expect(t((await answerRollcall("U-real", "rc:ans=30"))[0])).toContain("点呼の時間ではありません");
    // 登録していない人
    expect(t((await answerRollcall("U-nobody", "rc:ans=30"))[0])).toContain("登録がまだ");

    const rung = await ring();
    expect(rung.record.morning.rollcall.status).toBe("open");
    expect(rung.sent).toBe(1);
    expect((await ring()).sent).toBe(0); // 2回目は何もしない

    // おかしな値なら質問をもう一度
    expect((await answerRollcall("U-real", "rc:ans=99"))[0]).toMatchObject({ quickReply: expect.anything() });
    expect(t((await answerRollcall("U-real", "rc:ans=30"))[0])).toContain("6:40");
    let s = await loadMorning();
    expect(s.answers).toEqual([expect.objectContaining({ participantId: "p-real", answer: 30 })]);

    // 架空の住民の答えを足しても、本物の人の答えは残る
    fillAnswers(s, { participants: [...TOWN_ROSTER.participants, (await memoryRepo.findParticipant("p-real"))!], bases: TOWN_ROSTER.bases }, 7);
    await saveMorning(s);
    expect(s.answers.find((a) => a.participantId === "p-real")?.answer).toBe(30);

    const planned = await plan();
    s = planned.record;
    expect(s.morning.rollcall.status).toBe("planned");
    expect(s.morning.missions.length).toBeGreaterThan(0);
    expect(planned.sent).toBe(1); // LINE のある人にだけ
    expect((await plan()).sent).toBe(0); // もう一度は走らない
  });

  it("6:40 の自動配信は、今日の点呼が open のときだけ", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 10 });
    await ring();
    // 今日ではない日付（デモの 12/14）の点呼には反応しない
    expect(await planIfDue(new Date("2026-11-03T12:00:00Z"))).toBe(false);

    const now = new Date();
    const today = jstDate(now);
    const s = await loadMorning();
    s.morning.rollcall.date = today;
    await saveMorning(s);
    const before640 = new Date(`${today}T06:39:00+09:00`);
    const after640 = new Date(`${today}T06:40:00+09:00`);
    expect(await planIfDue(before640)).toBe(false);
    expect(await planIfDue(after640)).toBe(true);
    expect((await loadMorning()).morning.rollcall.status).toBe("planned");
    expect(await planIfDue(after640)).toBe(false);
  });
});
