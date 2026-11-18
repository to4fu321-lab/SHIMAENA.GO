// Claude のトークンの、町全体の1日の上限（11/18 本人の指示「トークンの1日の利用量の固定」）。
// 呼ぶ前に今日の合計を見て、上限を超えていたら Claude を呼ばず、鍵がないときと同じ決まった文で答える（画面は止まらない）。
// 数え方: 入力 + 出力 + キャッシュ書き込み + キャッシュ読み出しの 1/10（読み出しは料金が 1/10 なので）。
// 上限は Vercel の環境変数 CLAUDE_TOKENS_PER_DAY で変えられる（既定 30 万）。日付は日本時間。DB があれば claude_usage 表、なければメモリで数える。
import { hasDb, query } from "../db";
import { jstDate } from "../jst";
import { recordProblem } from "../ops/problems";

export const DEFAULT_TOKENS_PER_DAY = 300_000;

export function tokensPerDay(): number {
  const raw = process.env.CLAUDE_TOKENS_PER_DAY;
  const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_TOKENS_PER_DAY;
}

export interface UsageLike {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

/** 1回の呼び出しで使ったトークン（上限に数える量） */
export function countTokens(u: UsageLike | undefined | null): number {
  if (!u) return 0;
  return (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) + Math.ceil((u.cache_read_input_tokens ?? 0) / 10);
}

/** DB を毎回読まないよう、少しのあいだ覚えておく（別のサーバーで使った分は最大この時間おくれて分かる） */
const MEMO_MS = 20_000;
const g = globalThis as { __shimaenaClaudeUsage?: { date: string; used: number; at: number }; __shimaenaClaudeUsageTable?: boolean };

async function ensureTable(): Promise<void> {
  if (g.__shimaenaClaudeUsageTable) return;
  await query("create table if not exists claude_usage (date text primary key, tokens bigint not null default 0)");
  g.__shimaenaClaudeUsageTable = true;
}

/** 今日使ったトークン */
export async function usedToday(now = new Date()): Promise<number> {
  const date = jstDate(now);
  const m = g.__shimaenaClaudeUsage;
  if (m && m.date === date && (!hasDb() || Date.now() - m.at < MEMO_MS)) return m.used;
  if (!hasDb()) {
    g.__shimaenaClaudeUsage = { date, used: 0, at: Date.now() };
    return 0;
  }
  try {
    await ensureTable();
    const rows = await query<{ tokens: number | string }>("select tokens from claude_usage where date = $1", [date]);
    const used = Number(rows[0]?.tokens ?? 0);
    g.__shimaenaClaudeUsage = { date, used, at: Date.now() };
    return used;
  } catch (e) {
    await recordProblem("claude/budget", e);
    return m && m.date === date ? m.used : 0;
  }
}

/** まだ Claude を呼んでよいか（今日の合計が上限より少ないか） */
export async function underBudget(now = new Date()): Promise<boolean> {
  return (await usedToday(now)) < tokensPerDay();
}

/** 前に見たときに、今日の上限を使い切っていたか（待たずに分かる。画面の文を分けるため） */
export function budgetSpentKnown(now = new Date()): boolean {
  const m = g.__shimaenaClaudeUsage;
  return Boolean(m && m.date === jstDate(now) && m.used >= tokensPerDay());
}

/** 使った分を足す。失敗しても呼び出しの答えは捨てない */
export async function recordUsage(u: UsageLike | undefined | null, now = new Date()): Promise<void> {
  const n = countTokens(u);
  if (n <= 0) return;
  const date = jstDate(now);
  const m = g.__shimaenaClaudeUsage;
  const local = (m && m.date === date ? m.used : 0) + n;
  g.__shimaenaClaudeUsage = { date, used: local, at: m && m.date === date ? m.at : Date.now() };
  if (!hasDb()) return;
  try {
    await ensureTable();
    const rows = await query<{ tokens: number | string }>(
      "insert into claude_usage (date, tokens) values ($1, $2) on conflict (date) do update set tokens = claude_usage.tokens + $2 returning tokens",
      [date, n],
    );
    g.__shimaenaClaudeUsage = { date, used: Number(rows[0]?.tokens ?? local), at: Date.now() };
  } catch (e) {
    await recordProblem("claude/budget", e);
  }
}

/** テスト用: 覚えている数を消す */
export function resetBudgetMemo(): void {
  delete g.__shimaenaClaudeUsage;
}
