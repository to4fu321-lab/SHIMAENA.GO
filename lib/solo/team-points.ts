// ソロ出動のチーム得点の置き場所（spec v1.7）。
// 雪の朝（今朝の状態の日付と同じ日）は、今朝の得点（morning_state の scores）に入れる → 地図・ホーム・週の集計にそのまま出る。
// 雪のない日は、日付ごとの行（morning_state の「solo_scores:YYYY-MM-DD」）に足しておき、日曜の「今週の群れ」で合わせる。
// 表を増やさない。足すのは SQL の1文で、同時に書いても消えない。
import { hasDb, query } from "../db";
import { isDeployed } from "../env";
import { soloPointsOf } from "../game/score";
import type { MorningRecord } from "../morning/flow";
import { saveMorning } from "../morning/store";
import type { ScoreEvent } from "../types";

const PREFIX = "solo_scores:";
const g = globalThis as { __shimaenaSoloScores?: Map<string, ScoreEvent[]> };
const mem = () => (g.__shimaenaSoloScores ??= new Map());

/** 雪のない日の分を読む（from 〜 to、両端を含む） */
export async function listSoloScores(from: string, to: string): Promise<ScoreEvent[]> {
  if (hasDb()) {
    try {
      const rows = await query<{ state: { items?: ScoreEvent[] } }>(
        "select state from morning_state where key >= $1 and key <= $2 order by key",
        [PREFIX + from, PREFIX + to],
      );
      return rows.flatMap((r) => r.state.items ?? []);
    } catch (e) {
      if (isDeployed()) throw e;
      console.error("[solo/team-points] 読めないのでメモリで続けます:", e instanceof Error ? e.message : e);
    }
  }
  return [...mem().entries()].filter(([d]) => d >= from && d <= to).flatMap(([, v]) => v);
}

async function appendSideScores(date: string, events: ScoreEvent[]): Promise<void> {
  mem().set(date, [...(mem().get(date) ?? []), ...events]);
  if (!hasDb()) return;
  await query(
    `insert into morning_state (key, state, updated_at) values ($1, jsonb_build_object('items', $2::jsonb), now())
     on conflict (key) do update set updated_at = now(),
       state = jsonb_build_object('items', coalesce(morning_state.state->'items', '[]'::jsonb) || $2::jsonb)`,
    [PREFIX + date, JSON.stringify(events)],
  );
}

/** その人がその日に、ソロでもうチームに入れた点（全部と、そのうちオンラインの分） */
export async function soloPointsToday(record: MorningRecord, participantId: string, date: string): Promise<{ all: number; online: number }> {
  const events = record.morning.rollcall.date === date ? record.morning.scores : await listSoloScores(date, date);
  return { all: soloPointsOf(events, participantId), online: soloPointsOf(events, participantId, true) };
}

/** ソロのチーム得点を記録する（雪の朝は今朝の得点に、それ以外は日付の行に） */
export async function addSoloScores(record: MorningRecord, date: string, events: ScoreEvent[]): Promise<void> {
  if (events.length === 0) return;
  if (record.morning.rollcall.date === date) {
    record.morning.scores.push(...events);
    await saveMorning(record);
    return;
  }
  await appendSideScores(date, events);
}
