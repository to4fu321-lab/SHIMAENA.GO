// 隊長のひとこと（状態別、spec v1.6）: 状態は計算、文は朝に1回だけ。おかしい文は定型に戻す
import { describe, expect, it } from "vitest";
import { CAPTAIN_MAX, CAPTAIN_STATES, CAPTAIN_TEMPLATES, captainLine, captainLineOk, captainState, type CaptainFacts } from "./captain";
import { captainLines } from "./claude/captain";
import { DEMO_DATE } from "./morning/flow";
import { announce, ring } from "./morning/ops";

const base: CaptainFacts = { safety: false, role: "helper", almostGoal: false, cards: 3, todayActs: 0, streak: 0, daysSinceLast: 1 };

describe("隊長のひとこと", () => {
  it("状態は上から順: 安全 → お願いする側 → あと1軒 → はじめての出撃 → はじめて → しばらくぶり → 連続 → ふだん", () => {
    expect(captainState({ ...base, safety: true, role: "requester", almostGoal: true })).toBe("safety");
    expect(captainState({ ...base, role: "requester", almostGoal: true })).toBe("requester");
    expect(captainState({ ...base, almostGoal: true })).toBe("almost_goal");
    expect(captainState({ ...base, cards: 1, todayActs: 1 })).toBe("first_done");
    expect(captainState({ ...base, cards: 0, todayActs: 0 })).toBe("first");
    expect(captainState({ ...base, daysSinceLast: 3 })).toBe("away");
    expect(captainState({ ...base, streak: 3 })).toBe("streak");
    expect(captainState(base)).toBe("normal");
  });

  it("定型は吹き出しに収まり、お願いする側と安全は丁寧語。安全は「ひとり」か「休む」を言う", () => {
    for (const s of CAPTAIN_STATES) expect(captainLineOk(s, CAPTAIN_TEMPLATES[s], [10, 15, 1])).toBe(true);
    expect([...CAPTAIN_TEMPLATES.normal].length).toBeLessThanOrEqual(CAPTAIN_MAX);
  });

  it("おかしい文は使わない（長すぎ・語尾・数字を作る・安全の言葉がない）", () => {
    expect(captainLineOk("normal", "あ".repeat(CAPTAIN_MAX + 1), [12])).toBe(false);
    expect(captainLineOk("requester", "任せてほしいしま〜！", [12])).toBe(false);
    expect(captainLineOk("normal", "今朝は30人が出撃だしま〜！", [12, 5, 15, 1])).toBe(false);
    expect(captainLineOk("safety", "今朝もがんばろう！", [])).toBe(false);
    expect(captainLine("first", { first: "ようこそ！" })).toBe("ようこそ！");
    expect(captainLine("first", {})).toBe(CAPTAIN_TEMPLATES.first);
  });

  it("キーがないときは定型。点呼の時に1回だけ書いて朝の記録に残る", async () => {
    expect(await captainLines({ snowCm: 12, safety: false })).toEqual(CAPTAIN_TEMPLATES);
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    const { record } = await ring();
    expect(record.captainLines?.normal).toBe(CAPTAIN_TEMPLATES.normal);
  });
});

import { captainRotation } from "./captain";

describe("吹き出しで順番に話す（11/4）", () => {
  const base = { main: "どか雪のモッサリ、12cm。5分の出番だしま〜！", active: 3, left: 2, night: false, morningBonus: true, dokayuki: false };
  it("状態別のひとことのあとに、いまの様子。古い「5分」は10分に直す", () => {
    const ls = captainRotation({ ...base, snowCm: 12, teamName: "サルビア" });
    expect(ls[0]).toBe("どか雪のモッサリ、12cm。10分の出番だしま〜！");
    expect(ls).toContain("いま3人が雪かき中えな〜！");
    expect(ls).toContain("待っている家が、あと2軒あるしま〜。");
    expect(ls.some((l) => l.includes("サルビア"))).toBe(true);
  });
  it("夜はよその家にさそわない", () => {
    const ls = captainRotation({ ...base, night: true });
    expect(ls.join("")).not.toContain("雪かき中");
    expect(ls).toContain("夜は自分の家の雪かきだけにしようね。");
    expect(captainRotation({ ...base, night: true, homeToday: 4 })).toContain("今日は4人が、自分の家の雪かきをしたしま〜！");
  });
  it("安全の一文は何度も挟む", () => {
    const ls = captainRotation({ ...base, safety: "ひとりでやらず、15分ごとに休みましょう。" });
    expect(ls.filter((l) => l.includes("休み")).length).toBeGreaterThanOrEqual(2);
  });
});
