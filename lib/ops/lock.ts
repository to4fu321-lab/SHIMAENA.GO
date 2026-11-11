// 「今朝の状態」を書き換える処理を、エリアで1つずつ順番に行うための鍵。
// 状態は morning_state の1行（JSON）なので、2台のスマホが同時に「行く」を押すと、後に保存した方が前の変更を消してしまう。
// 入口（LINE の Webhook・画面の操作・定期実行）でこの鍵を取ってから、読む → 書き換える → 保存する。
// DB があれば state_locks 表で（Vercel の別々のサーバーどうしでも効く）、なければ同じサーバーの中で順番に。
// 鍵には期限（2分）があり、途中で落ちたサーバーがあっても、町が止まったままにはならない。
import { AsyncLocalStorage } from "node:async_hooks";
import { randomBytes } from "node:crypto";
import { hasDb, query } from "../db";
import { recordProblem } from "./problems";

const KEY = "morning";
const TTL_SECONDS = 120;
const WAIT_MS = 60_000;
const STEP_MS = 150;

const held = new AsyncLocalStorage<string>();
/** いま順番の鍵の中にいるか（テストと見張り用） */
export const isLockHeld = (): boolean => Boolean(held.getStore());
const g = globalThis as { __shimaenaLockChain?: Promise<unknown>; __shimaenaLockTable?: boolean };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function ensureTable(): Promise<void> {
  if (g.__shimaenaLockTable) return;
  await query("create table if not exists state_locks (key text primary key, holder text not null, until timestamptz not null)");
  g.__shimaenaLockTable = true;
}

/** 鍵を取れたら true（期限切れの鍵は取り直せる） */
async function tryAcquire(holder: string): Promise<boolean> {
  const rows = await query<{ holder: string }>(
    `insert into state_locks (key, holder, until) values ($1, $2, now() + make_interval(secs => $3))
     on conflict (key) do update set holder = excluded.holder, until = excluded.until
     where state_locks.until < now()
     returning holder`,
    [KEY, holder, TTL_SECONDS],
  );
  return rows[0]?.holder === holder;
}

async function release(holder: string): Promise<void> {
  await query("delete from state_locks where key = $1 and holder = $2", [KEY, holder]);
}

/** メモリのとき: 同じサーバーの中で1つずつ */
async function inProcess<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__shimaenaLockChain ?? Promise.resolve();
  let done!: () => void;
  const mine = new Promise<void>((r) => (done = r));
  g.__shimaenaLockChain = prev.then(() => mine);
  await prev.catch(() => undefined);
  try {
    return await fn();
  } finally {
    done();
  }
}

/**
 * fn を、今朝の状態の鍵を持った状態で動かす。中でもう一度呼ばれたら、そのまま動かす（二重に待たない）。
 * 待ちきれない・DB の鍵が使えないときは、問題として記録してから動かす（止めるよりはましなので）。
 */
export async function withStateLock<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (held.getStore()) return fn();
  if (!hasDb()) return inProcess(() => held.run("memory", fn));

  const holder = `${label}:${randomBytes(6).toString("hex")}`;
  let acquired = false;
  try {
    await ensureTable();
    const until = Date.now() + WAIT_MS;
    while (!(acquired = await tryAcquire(holder)) && Date.now() < until) await sleep(STEP_MS);
    if (!acquired) await recordProblem(`lock/${label}`, "順番待ちが長すぎたので、鍵なしで続けました");
  } catch (e) {
    await recordProblem(`lock/${label}`, e);
  }
  try {
    return await held.run(holder, fn);
  } finally {
    if (acquired) await release(holder).catch((e) => recordProblem(`lock/${label}`, e));
  }
}
