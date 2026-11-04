// LINE のプッシュの通数を月ごとに数える（無料プランは月 200 通。数え方は「送った相手の人数」）。
// 返信（reply）は無料なので数えない。LINE_DRY_RUN のときは「送らなかった分」として別に数える。
// 数字は LINE Official Account Manager の実数と同じとは限らない（目安）。撮影の前に照らし合わせる。
import { hasDb, query } from "../db";
import { jstDate } from "../jst";

export interface LineUsage {
  month: string; // YYYY-MM（日本時間）
  sent: number;
  dryRun: number;
}

const g = globalThis as { __shimaenaLineUsage?: Record<string, LineUsage> };

export function monthKey(now = new Date()): string {
  return jstDate(now).slice(0, 7);
}

/** 通数を足す。数え損ねても送信は止めない */
export async function countLinePush(recipients: number, dryRun: boolean, now = new Date()): Promise<void> {
  if (recipients <= 0) return;
  const month = monthKey(now);
  const mem = (g.__shimaenaLineUsage ??= {});
  const cur = (mem[month] ??= { month, sent: 0, dryRun: 0 });
  if (dryRun) cur.dryRun += recipients;
  else cur.sent += recipients;
  if (!hasDb()) return;
  const field = dryRun ? "dryRun" : "sent";
  try {
    await query(
      `insert into morning_state (key, state, updated_at) values ($1, jsonb_build_object('month', $2::text, 'sent', 0, 'dryRun', 0) || jsonb_build_object($3::text, $4::int), now())
       on conflict (key) do update set updated_at = now(),
         state = morning_state.state || jsonb_build_object($3::text, coalesce((morning_state.state->>$3)::int, 0) + $4::int)`,
      [`line_usage:${month}`, month, field, recipients],
    );
  } catch (e) {
    console.error("[line-usage] 数えられませんでした:", e instanceof Error ? e.message : e);
  }
}

export async function readLineUsage(now = new Date()): Promise<LineUsage> {
  const month = monthKey(now);
  if (hasDb()) {
    try {
      const rows = await query<{ state: Partial<LineUsage> }>("select state from morning_state where key = $1", [`line_usage:${month}`]);
      const s = rows[0]?.state;
      return { month, sent: Number(s?.sent ?? 0), dryRun: Number(s?.dryRun ?? 0) };
    } catch (e) {
      console.error("[line-usage] 読めませんでした:", e instanceof Error ? e.message : e);
    }
  }
  const mem = g.__shimaenaLineUsage?.[month];
  return mem ? { ...mem } : { month, sent: 0, dryRun: 0 };
}
