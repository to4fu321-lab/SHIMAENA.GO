// T114: 足りない列は、最初の問い合わせの前に1回だけ自動で入る
import { afterEach, describe, expect, it, vi } from "vitest";

const calls: string[] = [];
let existing: { t: string; c: string }[] = [];
vi.mock("@neondatabase/serverless", () => ({
  neon: () => ({
    query: async (text: string) => {
      calls.push(text);
      if (text.includes("information_schema.columns")) return existing;
      return [];
    },
  }),
}));

afterEach(() => {
  calls.length = 0;
  delete process.env.DATABASE_URL;
  vi.resetModules();
});

describe("足りない列を自動で入れる（T114）", () => {
  it("表はあるのに列がないときだけ alter を流し、2回目の問い合わせでは何もしない", async () => {
    process.env.DATABASE_URL = "postgres://test";
    existing = [
      { t: "solo_logs", c: "id" },
      { t: "cards", c: "id" },
      { t: "cards", c: "back_svg" },
    ];
    const { query } = await import("./index");
    await query("select 1");
    await query("select 2");
    expect(calls.filter((c) => c.startsWith("alter table"))).toEqual(["alter table solo_logs add column if not exists strokes integer"]);
    expect(calls.filter((c) => c.includes("information_schema.columns"))).toHaveLength(1);
    expect(calls.filter((c) => c.startsWith("select ")).slice(-2)).toEqual(["select 1", "select 2"]);
  });

  it("表がまだないときは alter を流さない（表は /admin の「DB を準備する」で作る）", async () => {
    process.env.DATABASE_URL = "postgres://test";
    existing = [];
    const { query } = await import("./index");
    await query("select 1");
    expect(calls.some((c) => c.startsWith("alter table"))).toBe(false);
  });
});
