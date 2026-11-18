import { afterEach, describe, expect, it } from "vitest";
import { budgetSpentKnown, countTokens, DEFAULT_TOKENS_PER_DAY, recordUsage, resetBudgetMemo, tokensPerDay, underBudget, usedToday } from "./budget";
import { systemPrompt } from "./client";

const NOW = new Date("2026-12-14T07:30:00+09:00");

afterEach(() => {
  delete process.env.CLAUDE_TOKENS_PER_DAY;
  resetBudgetMemo();
});

describe("1日のトークン上限（11/18）", () => {
  it("既定は30万。環境変数で変えられ、おかしな値なら既定", () => {
    expect(tokensPerDay()).toBe(DEFAULT_TOKENS_PER_DAY);
    process.env.CLAUDE_TOKENS_PER_DAY = "1000";
    expect(tokensPerDay()).toBe(1000);
    process.env.CLAUDE_TOKENS_PER_DAY = "たくさん";
    expect(tokensPerDay()).toBe(DEFAULT_TOKENS_PER_DAY);
  });
  it("数え方: 入力＋出力＋キャッシュ書き込み＋キャッシュ読み出しの1/10", () => {
    expect(countTokens({ input_tokens: 100, output_tokens: 50, cache_creation_input_tokens: 10, cache_read_input_tokens: 1000 })).toBe(260);
    expect(countTokens(undefined)).toBe(0);
  });
  it("使った分を足し、上限に届いたらその日は呼ばない。次の日は0から", async () => {
    process.env.CLAUDE_TOKENS_PER_DAY = "300";
    expect(await underBudget(NOW)).toBe(true);
    await recordUsage({ input_tokens: 200, output_tokens: 50 }, NOW);
    expect(await usedToday(NOW)).toBe(250);
    expect(await underBudget(NOW)).toBe(true);
    await recordUsage({ input_tokens: 60 }, NOW);
    expect(await underBudget(NOW)).toBe(false);
    expect(budgetSpentKnown(NOW)).toBe(true);
    const tomorrow = new Date(NOW.getTime() + 86_400_000);
    expect(await underBudget(tomorrow)).toBe(true);
  });
});

describe("採点表は、関係する項目だけ渡す（11/18）", () => {
  it("共通（口調・安全）＋その仕事の項目だけ。省けば全部", () => {
    const s = systemPrompt(["photo"]);
    expect(s).toContain('"voice"');
    expect(s).toContain('"safety"');
    expect(s).toContain('"photo"');
    expect(s).not.toContain('"kikigaki"');
    expect(systemPrompt().length).toBeGreaterThan(s.length * 3);
    expect(systemPrompt()).toContain('"kikigaki"');
  });
});
