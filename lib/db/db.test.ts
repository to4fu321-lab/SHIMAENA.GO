import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { splitSql } from "./index";

describe("splitSql（schema.sql を1文ずつに分ける）", () => {
  it("コメントを落とし、; で分ける", () => {
    const out = splitSql(`-- 説明\ncreate table a (x int); -- 末尾の説明\n\ninsert into a values (1);\n`);
    expect(out).toEqual(["create table a (x int)", "insert into a values (1)"]);
  });

  it("本物の db/schema.sql は表の作成と初期データの文に分かれる", () => {
    const text = readFileSync("db/schema.sql", "utf8");
    const out = splitSql(text);
    const creates = out.filter((s) => s.startsWith("create table if not exists"));
    expect(creates.map((s) => s.split(/\s+/)[5])).toEqual([
      "teams",
      "participants",
      "family_links",
      "bases",
      "rollcalls",
      "rollcall_answers",
      "missions",
      "sorties",
      "score_events",
      "cards",
      "demo_state",
    ]);
    expect(out.at(-1)).toMatch(/^insert into teams/);
    for (const s of out) expect(s).not.toContain("--");
  });
});
