import { describe, expect, it } from "vitest";
import { mockWeeklyText } from "../claude/weekly";
import { weeklySummary } from "../game/week";
import { handleEvent } from "../line/handle";
import { menuItems, richMenuObject, richMenuSvg, setupRichMenu } from "../line/richmenu";
import type { LineEvent, TextMessage } from "../line/types";
import { memoryRepo } from "../repo";
import { DEMO_DATE, fillAnswers, type MorningRecord } from "./flow";
import { announce, completeWithPhoto, offerTaskNow, plan, ring, setGoing, weeklyRecap } from "./ops";
import { loadRoster, TOWN_ROSTER } from "./roster";
import { archiveMorning, listMornings, loadMorning, saveMorning } from "./store";
import { pickTaskNow } from "./watch";

// 吹き出しが分かれても読めるように、全部の文をつなげて調べる
const t = (m: { type: string } | { type: string }[]) => [m].flat().map((x) => (x as TextMessage).text ?? "").join("\n");

async function morningDone(date: string, seed: number): Promise<MorningRecord> {
  await announce({ date, forecastCm: 12 });
  await ring();
  const s = await loadMorning();
  fillAnswers(s, await loadRoster(), seed);
  await saveMorning(s);
  await plan();
  const planned = await loadMorning();
  // 人がそろった家を全部、7:15 に写真で完了にする
  for (const m of planned.morning.missions) {
    if (m.status !== "assigned") continue;
    const sortie = planned.morning.sorties.find((x) => x.missionId === m.id);
    if (sortie) await completeWithPhoto(sortie.participantId, { bytes: new Uint8Array([0xff, 0xd8, 0xff]), mediaType: "image/jpeg" }, new Date(`${date}T07:15:00+09:00`));
  }
  return loadMorning();
}

describe("週のまとめ（純粋な関数）", () => {
  it("得点の合計・順位・出撃日数・称号・週の目標・家族への回数", () => {
    const base = (date: string): MorningRecord => ({
      morning: {
        rollcall: { id: `rc-${date}`, date, forecastCm: 10, status: "planned" },
        missions: [{ id: `m-${date}`, rollcallId: `rc-${date}`, baseId: "base1", importance: 6, requiredPeople: 2, subtasks: [], status: "done", startAt: `${date}T07:00:00+09:00` }],
        sorties: [
          { id: `s1-${date}`, missionId: `m-${date}`, participantId: "h1", teamId: "salvia", subtaskIds: [], status: "done", rescue: false, completedAt: `${date}T07:30:00+09:00` },
          { id: `s2-${date}`, missionId: `m-${date}`, participantId: "h2", teamId: "marigold", subtaskIds: [], status: "done", rescue: false, completedAt: `${date}T07:30:00+09:00` },
        ],
        scores: [
          { id: `e1-${date}`, teamId: "salvia", points: 10, reason: "mission_done", at: date },
          { id: `e2-${date}`, teamId: "marigold", points: 10, reason: "mission_done", at: date },
        ],
        viewerId: "h1",
      },
      answers: [],
      messages: [],
      briefing: "",
      clockMin: 0,
      log: [],
    });
    const records = ["2026-12-14", "2026-12-15", "2026-12-16", "2026-12-17", "2026-12-18"].map(base);
    const w = weeklySummary(records, TOWN_ROSTER, "2026-12-13", "2026-12-20T21:00:00+09:00");
    expect(w.days).toBe(5);
    expect(w.missionsDone).toBe(5);
    expect(w.sortieDays.h1).toBe(5);
    expect(w.titles.find((x) => x.participantId === "h1")).toMatchObject({ title: "朝の群れの主", rareCard: true });
    // 全部 8:00 までに終えたので、関わった2チームは週の目標（チーム全員 +20）
    expect(w.goalTeams.sort()).toEqual(["marigold", "salvia"]);
    expect(w.goalEvents.every((e) => e.reason === "weekly_goal" && e.points === 20)).toBe(true);
    expect(w.teamTotals.lupinus).toBe(0);
    expect(w.ranking[2]).toBe("lupinus");
    const requester = TOWN_ROSTER.bases.find((b) => b.id === "base1")!.requesterId;
    expect(w.helpedCount[requester]).toBe(5);
    const text = mockWeeklyText(w);
    expect(text.commentary).toContain("5回");
    expect(text.commentary).toContain("朝の群れの主");
  });
});

describe("日曜のまとめ（メモリ保存・LINE には送らない）", () => {
  it("朝の記録は日付で残り、週のまとめで順位・称号・翌週のチームが決まる", async () => {
    const a = await morningDone("2026-12-14", 3);
    await archiveMorning(a);
    const b = await morningDone("2026-12-15", 4);
    expect((await listMornings("2026-12-13", "2026-12-19")).map((r) => r.morning.rollcall.date)).toEqual(["2026-12-14", "2026-12-15"]);
    const beforeTeams = Object.fromEntries((await loadRoster()).participants.filter((p) => p.role === "helper").map((p) => [p.id, p.teamId]));
    const r = await weeklyRecap(new Date("2026-12-15T12:00:00Z")); // JST 12/15 21:00（この週）
    expect(r.summary.days).toBe(2);
    expect(r.summary.missionsDone).toBeGreaterThan(0);
    expect(r.summary.ranking).toHaveLength(3);
    expect(Object.keys(r.nextTeams).length).toBeGreaterThanOrEqual(12);
    const after = Object.fromEntries((await loadRoster()).participants.filter((p) => p.role === "helper").map((p) => [p.id, p.teamId]));
    expect(after).toEqual({ ...beforeTeams, ...r.nextTeams });
    const s = await loadMorning();
    expect(s.weekly?.commentary).toContain("今週の群れ");
    expect(s.log.at(-1)).toContain("今週の群れ");
    expect(b.morning.rollcall.date).toBe("2026-12-15");
  });
});

describe("いまからやる", () => {
  it("近くの人手不足の家の小タスクを1件。向かっている人や終わった朝には出さない", async () => {
    await memoryRepo.upsertParticipant({
      id: "p-now", nickname: "いま子", role: "helper", location: [43.0405, 141.3705], lineUserId: "U-now", teamId: "lupinus", morningMinutes: 15, hasTools: false,
    });
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    const s = await loadMorning();
    fillAnswers(s, await loadRoster(), 5);
    await saveMorning(s);
    expect(t((await offerTaskNow("p-now", 5)))).toContain("ありません"); // 作戦前
    await plan();
    const planned = await loadMorning();
    const roster = await loadRoster();
    const me = roster.participants.find((p) => p.id === "p-now")!;
    const offer = pickTaskNow(planned, roster, me, 5);
    if (offer) {
      expect(offer.minutes).toBeLessThanOrEqual(5);
      const msgs = await offerTaskNow("p-now", 5);
      expect(t(msgs)).toContain("お願いできますか");
      expect((msgs.at(-1) as TextMessage).quickReply?.items[0].action).toMatchObject({ type: "postback", data: `help:go=${offer.mission.id}` });
    }
    // LINE: 「いまからやる」→ 何分？ → now:15
    const ev = (rest: Record<string, unknown>): LineEvent => ({ replyToken: "rt", source: { type: "user", userId: "U-now" }, timestamp: 0, ...rest }) as LineEvent;
    await handleEvent(ev({ type: "message", message: { id: "1", type: "text", text: "いまからやる" } }));
    await handleEvent(ev({ type: "postback", postback: { data: "now:15" } }));
    // 向かっている人には出さない
    const mine = planned.morning.sorties.find((x) => x.participantId === "p-now");
    if (mine) {
      await setGoing("p-now", true);
      expect(pickTaskNow(await loadMorning(), roster, me, 30)).toBeNull();
    }
  });
});

describe("リッチメニュー", () => {
  it("4つのボタン（出動する／町の地図／活動カード／使い方）。設定は Web へ。大きいサイズに隙間なく敷きつめる", async () => {
    const items = menuItems();
    expect(items.map((i) => i.label)).toEqual(["出動する", "町の地図", "活動カード", "使い方"]);
    const obj = richMenuObject(items);
    expect(obj.size).toEqual({ width: 2500, height: 1686 });
    expect(obj.areas).toHaveLength(4);
    expect(obj.areas[0].action).toEqual({ type: "message", label: "出動する", text: "出動する" });
    expect(obj.areas[0].bounds).toEqual({ x: 0, y: 0, width: 1250, height: 1686 });
    // タップ領域の面積の合計 = 画像の面積（すき間も重なりもない）
    const area = obj.areas.reduce((a, x) => a + x.bounds.width * x.bounds.height, 0);
    expect(area).toBe(2500 * 1686);
    expect(obj.chatBarText.length).toBeLessThanOrEqual(14);
    for (const a of obj.areas) expect(a.action.label.length).toBeLessThanOrEqual(20);
    const svg = richMenuSvg(items);
    for (const label of ["出動する", "町の地図", "活動カード", "使い方"]) expect(svg).toContain(label);
    expect(svg).not.toContain("設定");
    const r = await setupRichMenu(); // トークンなし → 画像だけ
    expect(r.richMenuId).toBeNull();
    expect(r.imageBytes).toBeGreaterThan(10_000);
    expect(r.imageBytes).toBeLessThan(1_000_000); // LINE の画像は 1MB まで
  });
});
