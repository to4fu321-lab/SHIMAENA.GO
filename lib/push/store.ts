// 端末への通知（Web Push）の購読（spec v1.17）。1つの端末（ブラウザ）＝1行。鍵は隊長トークの鍵（lib/inbox/key.ts）と同じ。
// DATABASE_URL があれば push_subscriptions 表、ない間はメモリ。
import { hasDb, query } from "../db";

export interface PushSubscriptionRow {
  endpoint: string;
  key: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  createdAt: string;
}

const TABLE = `create table if not exists push_subscriptions (
  endpoint text primary key,
  inbox_key text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now())`;
const INDEX = "create index if not exists push_subscriptions_key on push_subscriptions (inbox_key)";
let ready: Promise<void> | undefined;
const ensure = () =>
  (ready ??= query(TABLE)
    .then(() => query(INDEX))
    .then(() => undefined)
    .catch((e) => {
      ready = undefined;
      throw e;
    }));

const g = globalThis as { __shimaenaPush?: Map<string, PushSubscriptionRow> };
const mem = () => (g.__shimaenaPush ??= new Map());

/** 画面から届く購読の形（PushSubscription.toJSON()） */
export interface SubscriptionJson {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export function isSubscriptionJson(x: unknown): x is SubscriptionJson {
  const s = x as SubscriptionJson | undefined;
  return Boolean(s && typeof s.endpoint === "string" && /^https:\/\//.test(s.endpoint) && s.keys && typeof s.keys.p256dh === "string" && typeof s.keys.auth === "string");
}

export async function saveSubscription(key: string, sub: SubscriptionJson, userAgent?: string, now = new Date()): Promise<void> {
  const row: PushSubscriptionRow = { endpoint: sub.endpoint, key, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent?.slice(0, 200), createdAt: now.toISOString() };
  if (!hasDb()) {
    mem().set(row.endpoint, row);
    return;
  }
  await ensure();
  await query(
    `insert into push_subscriptions (endpoint, inbox_key, p256dh, auth, user_agent, created_at) values ($1, $2, $3, $4, $5, $6)
     on conflict (endpoint) do update set inbox_key = excluded.inbox_key, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent`,
    [row.endpoint, row.key, row.p256dh, row.auth, row.userAgent ?? null, row.createdAt],
  );
}

export async function removeSubscription(endpoint: string): Promise<void> {
  mem().delete(endpoint);
  if (hasDb()) {
    await ensure();
    await query("delete from push_subscriptions where endpoint = $1", [endpoint]);
  }
}

export async function listSubscriptions(key: string): Promise<PushSubscriptionRow[]> {
  if (!hasDb()) return [...mem().values()].filter((r: PushSubscriptionRow) => r.key === key);
  await ensure();
  const rows = await query<{ endpoint: string; inbox_key: string; p256dh: string; auth: string; user_agent: string | null; created_at: string }>(
    "select endpoint, inbox_key, p256dh, auth, user_agent, created_at from push_subscriptions where inbox_key = $1",
    [key],
  );
  return rows.map((r) => ({ endpoint: r.endpoint, key: r.inbox_key, p256dh: r.p256dh, auth: r.auth, userAgent: r.user_agent ?? undefined, createdAt: new Date(r.created_at).toISOString() }));
}

/** 通知をオンにした端末の数と人数（/admin） */
export async function countSubscriptions(): Promise<{ devices: number; people: number }> {
  if (!hasDb()) {
    const rows = [...mem().values()];
    return { devices: rows.length, people: new Set(rows.map((r: PushSubscriptionRow) => r.key)).size };
  }
  await ensure();
  const rows = await query<{ d: string; p: string }>("select count(*)::text as d, count(distinct inbox_key)::text as p from push_subscriptions");
  return { devices: Number(rows[0]?.d ?? 0), people: Number(rows[0]?.p ?? 0) };
}
