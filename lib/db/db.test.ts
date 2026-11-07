import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ADDED_COLUMNS, splitSql, tableNames } from "./index";

describe("splitSql（schema.sql を1文ずつに分ける）", () => {
  it("コメントを落とし、; で分ける", () => {
    const out = splitSql(`-- 説明\ncreate table a (x int); -- 末尾の説明\n\ninsert into a values (1);\n`);
    expect(out).toEqual(["create table a (x int)", "insert into a values (1)"]);
  });

  it("本物の db/schema.sql は表の作成と初期データの文に分かれる", () => {
    const text = readFileSync("db/schema.sql", "utf8");
    const out = splitSql(text);
    expect(tableNames(out)).toEqual([
      "teams",
      "participants",
      "family_links",
      "bases",
      "cards",
      "morning_state",
      "line_sessions",
      "solo_logs",
      "town_cheers",
      "line_events",
      "chat_quota",
      "state_locks",
      "road_reports",
      "road_alert_prefs",
      "road_alert_sends",
      "nakama_prefs",
      "meetups",
      "batons",
      "baton_reactions",
      "inbox_messages",
      "push_subscriptions",
      "participant_profiles",
      "voice_logs",
      "my_profiles",
      "nakama_waves",
      "feedback_reports",
      "translations",
    ]);
    expect(out.at(-1)).toMatch(/^insert into teams/);
    for (const s of out) expect(s).not.toContain("--");
  });
});

describe("あとから足した列（T114）", () => {
  it("db/schema.sql の alter table … add column と ADDED_COLUMNS が同じ（片方だけに足すと本番で列が入らない）", () => {
    const fromSql = splitSql(readFileSync("db/schema.sql", "utf8"))
      .map((s) => /^alter table\s+(\w+)\s+add column if not exists\s+(\w+)\s+(.+)$/i.exec(s))
      .filter((m): m is RegExpExecArray => Boolean(m))
      .map((m) => ({ table: m[1], column: m[2], type: m[3].trim() }));
    expect(ADDED_COLUMNS).toEqual(fromSql);
  });
});
