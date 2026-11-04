// LINE の同じイベントを2回処理しない（LINE は届かなかったと判断すると同じイベントを送り直す。isRedelivery）。
// webhookEventId を line_events 表に入れ、入れられた（初めての）ときだけ true。DB がなければメモリで。
// 記録に失敗したら処理する（取りこぼすよりは、まれな二重のほうがまし）。
import { hasDb, query } from "../db";
import { recordProblem } from "./problems";

const g = globalThis as { __shimaenaSeenEvents?: Set<string>; __shimaenaEventsTable?: boolean };
const MEM_MAX = 2000;

async function ensureTable(): Promise<void> {
  if (g.__shimaenaEventsTable) return;
  await query("create table if not exists line_events (event_id text primary key, received_at timestamptz not null default now())");
  g.__shimaenaEventsTable = true;
}

/** このイベントを初めて見たなら true（印を付ける） */
export async function firstTime(eventId: string | undefined): Promise<boolean> {
  if (!eventId) return true;
  if (!hasDb()) {
    const seen = (g.__shimaenaSeenEvents ??= new Set());
    if (seen.has(eventId)) return false;
    seen.add(eventId);
    if (seen.size > MEM_MAX) seen.delete(seen.values().next().value as string);
    return true;
  }
  try {
    await ensureTable();
    const rows = await query<{ event_id: string }>(
      "insert into line_events (event_id) values ($1) on conflict (event_id) do nothing returning event_id",
      [eventId],
    );
    if (Math.random() < 0.02) await query("delete from line_events where received_at < now() - interval '7 days'");
    return rows.length > 0;
  } catch (e) {
    await recordProblem("line/once", e);
    return true;
  }
}
