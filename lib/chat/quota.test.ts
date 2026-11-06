import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasClaudeKey, withMockClaude } from "../claude/client";
import { chatLimit, takeChatQuota } from "./quota";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "");
  delete (globalThis as Record<string, unknown>).__shimaenaChatQuota;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("隊長トークの1人1日の上限（お金の守り）", () => {
  it("架空の人は、文は 20 回、写真は 5 回まで Claude。超えた分は false（モック応答）。人と日付がちがえば別に数える", async () => {
    const day = new Date("2026-12-14T00:00:00+09:00");
    for (let i = 0; i < 20; i++) expect(await takeChatQuota("h1", "text", day)).toBe(true);
    expect(await takeChatQuota("h1", "text", day)).toBe(false);
    expect(await takeChatQuota("h2", "text", day)).toBe(true); // 別の人
    expect(await takeChatQuota("h1", "text", new Date("2026-12-15T00:00:00+09:00"))).toBe(true); // 翌日
    for (let i = 0; i < 5; i++) expect(await takeChatQuota("h1", "photo", day)).toBe(true);
    expect(await takeChatQuota("h1", "photo", day)).toBe(false);
  });
  it("ログインした本人（架空の人でない ID）は上限なし", async () => {
    const day = new Date("2026-12-14T00:00:00+09:00");
    for (let i = 0; i < 30; i++) expect(await takeChatQuota("p-real", "text", day)).toBe(true);
    for (let i = 0; i < 10; i++) expect(await takeChatQuota("p-real", "photo", day)).toBe(true);
  });
  it("上限は環境変数で変えられる（CHAT_TEXT_PER_DAY・CHAT_PHOTO_PER_DAY。変な値は既定）", () => {
    expect(chatLimit("text")).toBe(20);
    expect(chatLimit("photo")).toBe(5);
    vi.stubEnv("CHAT_TEXT_PER_DAY", "2");
    vi.stubEnv("CHAT_PHOTO_PER_DAY", "abc");
    expect(chatLimit("text")).toBe(2);
    expect(chatLimit("photo")).toBe(5);
  });
  it("withMockClaude の中では、鍵があっても hasClaudeKey が false（モック応答）になる", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    expect(hasClaudeKey()).toBe(true);
    const inside = await withMockClaude(async () => {
      await Promise.resolve();
      return hasClaudeKey();
    });
    expect(inside).toBe(false);
    expect(hasClaudeKey()).toBe(true);
  });
});
