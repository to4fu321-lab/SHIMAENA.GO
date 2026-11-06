import { describe, expect, it } from "vitest";
import { isOldCardFk, OLD_CARD_FKS } from "./index";

describe("カードの古い外部キー（11/6 本番で「カードを発行できませんでした」）", () => {
  it("Postgres の文面から、古い外部キーの失敗だと分かる", () => {
    expect(isOldCardFk(new Error('insert or update on table "cards" violates foreign key constraint "cards_rollcall_id_fkey"'))).toBe(true);
    expect(isOldCardFk(new Error('insert or update on table "cards" violates foreign key constraint "cards_mission_id_fkey"'))).toBe(true);
    expect(isOldCardFk(new Error("connection refused"))).toBe(false);
    expect(isOldCardFk("timeout")).toBe(false);
  });
  it("schema.sql に、その外部キーを外す文がある（DB を準備する で外れる）", async () => {
    const { readFile } = await import("node:fs/promises");
    const sql = await readFile("db/schema.sql", "utf8");
    for (const n of OLD_CARD_FKS) expect(sql).toContain(`drop constraint if exists ${n}`);
  });
});
