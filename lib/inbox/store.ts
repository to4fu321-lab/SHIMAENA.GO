// 隊長トーク（spec v1.17）: 隊長から届く文面（out）と、本人が送った文・写真（in）を、1人ぶんの流れとして保存する。
// 文面の形は、今までの LINE の形（LineMessage: 文・大きなボタンの吹き出し・画像）をそのまま使う。
// 保存先は inbox_messages 表（DATABASE_URL があるとき）。ない間はメモリ。
// 保存の失敗で雪かきの流れ（完了・得点）を止めない: 呼ぶ側（lib/line/client.ts）が /admin の「問題」に残す。
import { randomBytes } from "node:crypto";
import { hasDb, query } from "../db";
import type { LineMessage } from "../line/types";

/** 本人から隊長へ: 文か写真（写真そのものは保存しない。送った印だけ） */
export type InboxIn = { text: string } | { photo: true; note?: string };

export interface InboxItem {
  id: string;
  /** あて先の鍵（lib/inbox/key.ts） */
  key: string;
  /** out = 隊長から、in = 本人から */
  dir: "out" | "in";
  body: LineMessage | InboxIn;
  at: string; // ISO
  readAt?: string; // ISO（本人が開いた時刻。in の行には付けない）
}

/** 1人の流れとして読む上限（古いものは出さない） */
export const THREAD_LIMIT = 80;
/** これより古い行は消す（日） */
const KEEP_DAYS = 60;

const TABLE = `create table if not exists inbox_messages (
  id text primary key,
  inbox_key text not null,
  direction text not null,
  body jsonb not null,
  at timestamptz not null default now(),
  read_at timestamptz)`;
const INDEX = "create index if not exists inbox_messages_key on inbox_messages (inbox_key, at)";

let ready: Promise<void> | undefined;
const ensure = () =>
  (ready ??= query(TABLE)
    .then(() => query(INDEX))
    .then(() => undefined)
    .catch((e) => {
      ready = undefined;
      throw e;
    }));

const g = globalThis as { __shimaenaInbox?: Map<string, InboxItem[]> };
const mem = () => (g.__shimaenaInbox ??= new Map());
const memList = (key: string) => {
  const list = mem().get(key) ?? [];
  mem().set(key, list);
  return list;
};

const newId = () => `im-${randomBytes(8).toString("base64url")}`;

interface Row {
  id: string;
  inbox_key: string;
  direction: "out" | "in";
  body: InboxItem["body"];
  at: string;
  read_at: string | null;
}
const rowToItem = (r: Row): InboxItem => ({
  id: r.id,
  key: r.inbox_key,
  dir: r.direction,
  body: r.body,
  at: new Date(r.at).toISOString(),
  ...(r.read_at ? { readAt: new Date(r.read_at).toISOString() } : {}),
});

async function insert(items: InboxItem[]): Promise<void> {
  if (items.length === 0) return;
  if (!hasDb()) {
    for (const it of items) memList(it.key).push(it);
    return;
  }
  await ensure();
  for (const it of items) {
    await query("insert into inbox_messages (id, inbox_key, direction, body, at) values ($1, $2, $3, $4::jsonb, $5)", [it.id, it.key, it.dir, JSON.stringify(it.body), it.at]);
  }
  if (Math.random() < 0.05) await query(`delete from inbox_messages where at < now() - interval '${KEEP_DAYS} days'`);
}

/** 隊長からの文面を流れに足す（1つの吹き出し＝1行。順番が崩れないよう 1ms ずつずらす） */
export async function appendOut(key: string, messages: LineMessage[], now = new Date()): Promise<InboxItem[]> {
  const items = messages.map((m, i) => ({ id: newId(), key, dir: "out" as const, body: m, at: new Date(now.getTime() + i).toISOString() }));
  await insert(items);
  return items;
}

/** 本人が送った文・写真を流れに足す */
export async function appendIn(key: string, body: InboxIn, now = new Date()): Promise<InboxItem> {
  const item: InboxItem = { id: newId(), key, dir: "in", body, at: now.toISOString() };
  await insert([item]);
  return item;
}

/** 1人の流れ（古い → 新しい。最新の limit 件） */
export async function listThread(key: string, limit = THREAD_LIMIT): Promise<InboxItem[]> {
  if (!hasDb()) return memList(key).slice(-limit).map((x: InboxItem) => structuredClone(x));
  await ensure();
  const rows = await query<Row>("select id, inbox_key, direction, body, at, read_at from inbox_messages where inbox_key = $1 order by at desc, id desc limit $2", [key, limit]);
  return rows.map(rowToItem).reverse();
}

/** まだ開いていない、隊長からの行の数（下のタブの数字） */
export async function unreadCount(key: string): Promise<number> {
  if (!hasDb()) return memList(key).filter((x: InboxItem) => x.dir === "out" && !x.readAt).length;
  await ensure();
  const rows = await query<{ n: string }>("select count(*)::text as n from inbox_messages where inbox_key = $1 and direction = 'out' and read_at is null", [key]);
  return Number(rows[0]?.n ?? 0);
}

/** 流れを開いた: 隊長からの行を全部「読んだ」にする */
export async function markRead(key: string, now = new Date()): Promise<void> {
  const at = now.toISOString();
  if (!hasDb()) {
    for (const x of memList(key)) if (x.dir === "out" && !x.readAt) x.readAt = at;
    return;
  }
  await ensure();
  await query("update inbox_messages set read_at = $2 where inbox_key = $1 and direction = 'out' and read_at is null", [key, at]);
}

/** 隊長から届いた行の数（from 以降。/admin の「通知の数」の目安） */
export async function countOutSince(fromIso: string): Promise<number> {
  if (!hasDb()) return [...mem().values()].flat().filter((x: InboxItem) => x.dir === "out" && x.at >= fromIso).length;
  await ensure();
  const rows = await query<{ n: string }>("select count(*)::text as n from inbox_messages where direction = 'out' and at >= $1", [fromIso]);
  return Number(rows[0]?.n ?? 0);
}
