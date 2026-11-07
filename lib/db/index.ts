// Neon（Postgres）への接続。素の SQL だけを使う。サーバー側でだけ使う。
// DATABASE_URL がない間は使わない（保存はメモリ）。
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { TOWN } from "../town";

export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

let sqlFn: NeonQueryFunction<false, false> | undefined;
function sql(): NeonQueryFunction<false, false> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL がありません");
  sqlFn ??= neon(url);
  return sqlFn;
}

/** 1つの SQL を実行して行を返す */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await sql().query(text, params)) as T[];
}

/**
 * schema.sql を文ごとに分ける（Neon の HTTP 接続は1回に1文なので）。
 * `--` のコメントを落とし、`;` で区切る。文字列の中に `;` や `--` を書かない前提。
 */
export function splitSql(text: string): string[] {
  const noComments = text
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  return noComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function schemaStatements(): Promise<string[]> {
  const text = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  return splitSql(text);
}

/** schema.sql にある表の名前（準備できているかの確認に使う） */
export function tableNames(statements: string[]): string[] {
  return statements.map((s) => /^create table if not exists (\w+)/i.exec(s)?.[1]).filter((t): t is string => Boolean(t));
}

/** db/schema.sql を適用する（何度押しても安全: create table if not exists / on conflict do nothing） */
export async function applySchema(): Promise<number> {
  const statements = await schemaStatements();
  for (const s of statements) await sql().query(s);
  return statements.length;
}

/** 架空の町内データ（参加者・拠点）を入れる。すでにあれば上書き */
export async function seedTown(): Promise<{ participants: number; bases: number }> {
  for (const p of TOWN.participants) {
    await sql().query(
      `insert into participants
         (id, nickname, role, lat, lng, team_id, solo_minutes, clear_area, level, morning_minutes, has_tools)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       on conflict (id) do update set
         nickname = excluded.nickname, role = excluded.role, lat = excluded.lat, lng = excluded.lng,
         team_id = excluded.team_id, solo_minutes = excluded.solo_minutes, clear_area = excluded.clear_area,
         level = excluded.level, morning_minutes = excluded.morning_minutes, has_tools = excluded.has_tools`,
      [
        p.id,
        p.nickname,
        p.role,
        p.location[0],
        p.location[1],
        p.teamId ?? null,
        p.soloMinutes == null ? null : String(p.soloMinutes),
        p.clearArea ?? null,
        p.level ?? null,
        p.morningMinutes ?? null,
        p.hasTools ?? null,
      ],
    );
  }
  for (const b of TOWN.bases) {
    await sql().query(
      `insert into bases (id, number, requester_id) values ($1, $2, $3)
       on conflict (id) do update set number = excluded.number, requester_id = excluded.requester_id`,
      [b.id, b.number, b.requesterId],
    );
  }
  return { participants: TOWN.participants.length, bases: TOWN.bases.length };
}

export type DbStatus =
  | { kind: "none" } // DATABASE_URL なし → メモリ
  | { kind: "unprepared"; missing: string[] } // つながるが表が足りない → /admin のボタンで準備
  | { kind: "ready"; participants: number }
  | { kind: "error"; message: string };

/** いまの DB の様子（/admin に出す） */
export async function dbStatus(): Promise<DbStatus> {
  if (!hasDb()) return { kind: "none" };
  try {
    const expected = tableNames(await schemaStatements());
    const rows = await query<{ table_name: string }>("select table_name from information_schema.tables where table_schema = 'public'");
    const existing = new Set(rows.map((r) => r.table_name));
    const missing = expected.filter((t) => !existing.has(t));
    // 古い版の表に残った外部キー（cards → rollcalls / missions）があると、ソロのカードが入らない。「DB を準備する」で外す
    const oldFks = await query<{ conname: string }>(
      "select conname from pg_constraint where conrelid = 'cards'::regclass and conname in ('cards_rollcall_id_fkey', 'cards_mission_id_fkey')",
    ).catch(() => []);
    for (const c of oldFks) missing.push(`cards の古い制約 ${c.conname} を外す`);
    // あとから足した列（schema.sql の alter table … add column）も見る。表があっても列がないと読み書きが失敗する（11/7 点検: solo_logs.strokes）
    const cols = await query<{ t: string; c: string }>(
      "select table_name as t, column_name as c from information_schema.columns where table_schema = 'public'",
    ).catch(() => []);
    const haveCol = new Set(cols.map((r) => `${r.t}.${r.c}`));
    for (const st of await schemaStatements()) {
      const m = /alter table\s+(\w+)\s+add column if not exists\s+(\w+)/i.exec(st);
      if (m && existing.has(m[1]) && !haveCol.has(`${m[1]}.${m[2]}`)) missing.push(`${m[1]}.${m[2]}（列）`);
    }
    if (missing.length > 0) return { kind: "unprepared", missing };
    const cnt = await query<{ n: string }>("select count(*)::text as n from participants");
    return { kind: "ready", participants: Number(cnt[0]?.n ?? 0) };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
