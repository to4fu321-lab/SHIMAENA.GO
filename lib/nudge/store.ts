// 隊長の声かけの記録（lib/nudge/rules.ts の NudgeState）。表を増やさず morning_state の「nudge:<参加者 ID>」に置く。DB がなければメモリ。
import { hasDb, query } from "../db";
import type { NudgeState } from "./rules";
import { appNow } from "@/lib/clock";

const key = (pid: string) => `nudge:${pid}`;
const g = globalThis as { __shimaenaNudge?: Map<string, NudgeState> };
const mem = () => (g.__shimaenaNudge ??= new Map());

export async function loadNudge(pid: string): Promise<NudgeState | undefined> {
  if (!hasDb()) return mem().get(pid);
  const rows = await query<{ state: NudgeState }>("select state from morning_state where key = $1", [key(pid)]);
  return rows[0]?.state;
}

export async function saveNudge(pid: string, s: NudgeState): Promise<void> {
  mem().set(pid, s);
  if (!hasDb()) return;
  await query(
    `insert into morning_state (key, state, updated_at) values ($1, $2::jsonb, now())
     on conflict (key) do update set state = excluded.state, updated_at = now()`,
    [key(pid), JSON.stringify(s)],
  );
}

/** 設定のスイッチ「隊長から声をかける」（既定オン） */
export async function setNudgeOff(pid: string, off: boolean, now = appNow()): Promise<void> {
  const s = (await loadNudge(pid)) ?? { firstSeen: now.toISOString() };
  await saveNudge(pid, { ...s, off });
}
