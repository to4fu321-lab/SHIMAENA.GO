// コンシェルジュの会話の途中（何往復目か・直近のやりとり）。10分で消える。選び終わったらすぐ消す。
// 表を増やさず morning_state の「concierge:<LINE のユーザー ID>」の行に置く。DB がなければメモリ。
// 体・病気のことばを含む文は、ここに残さない（呼ぶ側で入れない）。
import { hasDb, query } from "../db";
import type { ConciergeTurn } from "../claude/concierge";
import { appNow } from "@/lib/clock";

export interface ConciergeSession {
  turn: number;
  history: ConciergeTurn[];
  at: string; // ISO
  /** 直近の往復で見せた候補の id（同じボタンばかりにならないように） */
  shown?: string[];
}

/** 1回の相談の長さ（spec v1.17: 10分 → 60分） */
export const SESSION_TTL_MS = 60 * 60 * 1000;
const key = (lineUserId: string) => `concierge:${lineUserId}`;
const g = globalThis as { __shimaenaConcierge?: Map<string, ConciergeSession> };
const mem = () => (g.__shimaenaConcierge ??= new Map());

/** 続きの会話（10分以内）。なければ undefined */
export async function loadSession(lineUserId: string, now = appNow()): Promise<ConciergeSession | undefined> {
  let s: ConciergeSession | undefined;
  if (hasDb()) {
    try {
      const rows = await query<{ state: ConciergeSession }>("select state from morning_state where key = $1", [key(lineUserId)]);
      s = rows[0]?.state;
    } catch (e) {
      console.error("[concierge] 会話を読めませんでした:", e instanceof Error ? e.message : e);
    }
  } else s = mem().get(lineUserId);
  if (!s || now.getTime() - Date.parse(s.at) > SESSION_TTL_MS) return undefined;
  return s;
}

export async function saveSession(lineUserId: string, s: ConciergeSession): Promise<void> {
  if (!hasDb()) {
    mem().set(lineUserId, s);
    return;
  }
  await query(
    `insert into morning_state (key, state, updated_at) values ($1, $2::jsonb, now())
     on conflict (key) do update set state = excluded.state, updated_at = now()`,
    [key(lineUserId), JSON.stringify(s)],
  );
  // 古い会話（1日以上前）は残さない
  if (Math.random() < 0.1) await query("delete from morning_state where key like 'concierge:%' and updated_at < now() - interval '1 day'");
}

export async function clearSession(lineUserId: string): Promise<void> {
  mem().delete(lineUserId);
  if (hasDb()) await query("delete from morning_state where key = $1", [key(lineUserId)]);
}
