// 運用で起きた問題の記録（LINE の送信失敗・Webhook の処理失敗など）。/admin に赤く出して、運営者が気づけるようにする。
// 表を増やさず morning_state の「ops_problems」の行に、新しい順に最大 50 件だけ置く。追記は SQL の1文で行い、同時に書いても消えない。
import { hasDb, query } from "../db";

export interface Problem {
  at: string; // ISO
  where: string; // 例: line/push
  message: string;
}

const KEY = "ops_problems";
const MAX = 50;
const g = globalThis as { __shimaenaProblems?: Problem[] };

/** 問題を1件残す。記録そのものの失敗では止めない（console には必ず出す） */
export async function recordProblem(where: string, error: unknown, now = new Date()): Promise<void> {
  const message = (error instanceof Error ? error.message : String(error)).slice(0, 300);
  console.error(`[problem] ${where}: ${message}`);
  const item: Problem = { at: now.toISOString(), where, message };
  g.__shimaenaProblems = [item, ...(g.__shimaenaProblems ?? [])].slice(0, MAX);
  if (!hasDb()) return;
  try {
    await query(
      `insert into morning_state (key, state, updated_at) values ($1, jsonb_build_object('items', jsonb_build_array($2::jsonb)), now())
       on conflict (key) do update set updated_at = now(), state = jsonb_build_object('items',
         (select coalesce(jsonb_agg(e order by i), '[]'::jsonb) from (
            select e, i from jsonb_array_elements(jsonb_build_array($2::jsonb) || coalesce(morning_state.state->'items', '[]'::jsonb))
            with ordinality as t(e, i) order by i limit ${MAX}) as kept))`,
      [KEY, JSON.stringify(item)],
    );
  } catch (e) {
    console.error("[problem] 記録できませんでした:", e instanceof Error ? e.message : e);
  }
}

/** 新しい順の問題（/admin 用） */
export async function listProblems(): Promise<Problem[]> {
  if (hasDb()) {
    try {
      const rows = await query<{ state: { items?: Problem[] } }>("select state from morning_state where key = $1", [KEY]);
      return rows[0]?.state.items ?? [];
    } catch (e) {
      console.error("[problem] 読めませんでした:", e instanceof Error ? e.message : e);
    }
  }
  return [...(g.__shimaenaProblems ?? [])];
}

/** 記録を空にする（/admin のボタン） */
export async function clearProblems(): Promise<void> {
  g.__shimaenaProblems = [];
  if (hasDb()) await query("delete from morning_state where key = $1", [KEY]);
}
