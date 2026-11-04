import { describe, expect, it } from "vitest";
import type { MorningRecord } from "../morning/flow";
import { TOWN_ROSTER } from "../morning/roster";
import { DEMO_MORNING } from "../morning/sample";
import { buildPublicStats } from "../public/stats";
import { refreshShareTexts, shareTextsFor } from "../sns/refresh";
import { mockShareText, SHARE_TEXT_MAX } from "../sns/text";
import { finishShareText, shareInput, shareKey, shareText, usesOnlyGivenNumbers } from "./share";

const rec = (): MorningRecord => ({ morning: structuredClone(DEMO_MORNING), answers: [], messages: [], briefing: "", clockMin: 0, log: [] });
const stats = () => buildPublicStats({ record: rec(), roster: TOWN_ROSTER, today: DEMO_MORNING.rollcall.date, soloWeek: [], weekRecords: [rec()], cheers: 0 });

describe("SNS の投稿文（Claude）", () => {
  it("数字は渡したものだけ（作った数字なら定型に戻す）", () => {
    const st = stats();
    const input = shareInput("today", st);
    expect(usesOnlyGivenNumbers(`今日は${st.todayPeople}人が出動。あと${st.left}軒、10分だけ。`, input)).toBe(true);
    expect(usesOnlyGivenNumbers("今日は999人が出動！", input)).toBe(false);
    expect(usesOnlyGivenNumbers("今日は９９９人", input)).toBe(false); // 全角でも
  });

  it("仕上げ: #シマエナGO を必ず入れ、115字に収める", () => {
    expect(finishShareText("雪がとけた")).toContain("#シマエナGO");
    expect([...finishShareText("あ".repeat(300))].length).toBeLessThanOrEqual(SHARE_TEXT_MAX);
  });

  it("数字が変わると鍵が変わる（作り直しの合図）", () => {
    const st = stats();
    expect(shareKey("today", st)).toBe(shareKey("today", { ...st }));
    expect(shareKey("today", st)).not.toBe(shareKey("today", { ...st, todayPeople: st.todayPeople + 1 }));
    expect(shareKey("town", st)).toBe(shareKey("town", { ...st, todayPeople: st.todayPeople + 1 })); // 関係ない数字では変わらない
  });

  it("キーがなければ定型。画面は保存がなくても定型を出す", async () => {
    if (process.env.ANTHROPIC_API_KEY) return;
    const st = stats();
    expect(await shareText("recruit", st)).toEqual({ text: mockShareText("recruit", st), byClaude: false });
    expect(await refreshShareTexts()).toBe(0);
    expect((await shareTextsFor(st)).town).toEqual({ text: mockShareText("town", st), byClaude: false });
  });
});
