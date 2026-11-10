// 隊長トークで Claude を呼ぶ回数の、1人1日の上限（公開中のお金の守り。11/6 外部レビュー）。
// DEMO_MODE のあいだは架空の人（?as=h1 など）として誰でも送れるので、回数に上限がないと Claude の費用が青天井になる。
// 上限は架空の人だけ。LINE でログインした本人は上限なし（11/6 本人の決定）。
// 超えた分は断らず、鍵がないときと同じモック応答で答える（画面は止まらない）。DB があれば chat_quota 表、なければメモリで数える。
import { hasDb, query } from "../db";
import { jstDate } from "../jst";
import { recordProblem } from "../ops/problems";
import { isDemoViewer } from "../viewer";
import { appNow } from "@/lib/clock";

export type ChatKind = "text" | "photo";

/** 既定の上限（1人1日）。Vercel の環境変数 CHAT_TEXT_PER_DAY・CHAT_PHOTO_PER_DAY で変えられる */
const DEFAULT_LIMIT: Record<ChatKind, number> = { text: 20, photo: 5 };
const ENV_NAME: Record<ChatKind, string> = { text: "CHAT_TEXT_PER_DAY", photo: "CHAT_PHOTO_PER_DAY" };

export function chatLimit(kind: ChatKind): number {
  const raw = process.env[ENV_NAME[kind]];
  const n = raw === undefined || raw.trim() === "" ? NaN : Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_LIMIT[kind];
}

const g = globalThis as { __shimaenaChatQuota?: Map<string, number>; __shimaenaChatQuotaTable?: boolean };
const MEM_MAX = 5000;
const mem = () => (g.__shimaenaChatQuota ??= new Map());

function countInMemory(key: string): number {
  const m = mem();
  const n = (m.get(key) ?? 0) + 1;
  m.set(key, n);
  if (m.size > MEM_MAX) m.delete(m.keys().next().value as string);
  return n;
}

async function countInDb(date: string, participantId: string, kind: ChatKind): Promise<number> {
  if (!g.__shimaenaChatQuotaTable) {
    await query(
      "create table if not exists chat_quota (date text not null, participant_id text not null, kind text not null, n integer not null default 0, primary key (date, participant_id, kind))",
    );
    g.__shimaenaChatQuotaTable = true;
  }
  const rows = await query<{ n: number | string }>(
    "insert into chat_quota (date, participant_id, kind, n) values ($1, $2, $3, 1) on conflict (date, participant_id, kind) do update set n = chat_quota.n + 1 returning n",
    [date, participantId, kind],
  );
  if (Math.random() < 0.02) await query("delete from chat_quota where date < $1", [jstDate(new Date(Date.now() - 7 * 86_400_000))]);
  return Number(rows[0]?.n ?? 1);
}

/**
 * 上限をかけるのは架空の人（?as=h1 などで誰でも使える）だけ。LINE でログインした本人は上限なし（11/6 本人の決定）。
 * 架空の人を誰でも呼べるのが心配の元なので、そこだけを守る。
 */
export function quotaApplies(participantId: string): boolean {
  return isDemoViewer(participantId);
}

/** 1回ぶん数えて、まだ Claude を呼んでよければ true。上限を超えていれば false（モック応答にする）。日付は本当の日本時間 */
export async function takeChatQuota(participantId: string, kind: ChatKind, now = appNow()): Promise<boolean> {
  if (!quotaApplies(participantId)) return true;
  const date = jstDate(now);
  let n: number;
  if (hasDb()) {
    try {
      n = await countInDb(date, participantId, kind);
    } catch (e) {
      await recordProblem("chat/quota", e);
      n = countInMemory(`${date}:${participantId}:${kind}`);
    }
  } else {
    n = countInMemory(`${date}:${participantId}:${kind}`);
  }
  return n <= chatLimit(kind);
}
