// 「今朝の状態」の保存先。DATABASE_URL があれば Neon の morning_state 表に JSON でまるごと置く。
// ない間はサーバーのメモリに持つ（開発用。Vercel ではリクエストごとに別のサーバーになるので DB が要る）。
import { hasDb, query } from "../db";
import { memoClear, memoPut, memoRead } from "../db/memo";
import { isDeployed } from "../env";
import { recordProblem } from "../ops/problems";
import type { MorningRecord } from "./flow";
import { DEMO_MORNING } from "./sample";

const g = globalThis as { __shimaenaMorning?: MorningRecord };
const KEY = "current";

/** 最初は「朝 7:10 ごろの途中の状態」（地図を開いたとき見栄えがするように） */
function initial(): MorningRecord {
  return {
    morning: structuredClone(DEMO_MORNING),
    answers: [],
    messages: [],
    briefing: "今朝の予報は12cm。8軒を7:00から始めます。人手が足りない家が1軒あります。",
    clockMin: 7 * 60 + 10,
    log: ["デモの途中の状態から始めています"],
  };
}

/**
 * DB の不調（表がまだない・つながらない）のとき。
 * 手元の開発では画面を止めず、メモリに退避して続ける。
 * 公開している環境（Vercel）では退避しない: サーバーが別々なので、退避すると「保存できたように見えて消える」から。
 * 失敗をそのまま返し、/admin の「問題」に残す。
 */
function fallback(e: unknown): void {
  if (isDeployed()) {
    void recordProblem("morning/store", e);
    throw e;
  }
  console.error("[morning/store] DB に保存できないのでメモリで続けます:", e instanceof Error ? e.message : e);
}

/** 同じリクエストの中では1回だけ DB から読む（lib/db/memo.ts）。保存すれば置き換え、claimPlanning のあとは読み直す */
const MEMO = "morning:current";

/** いまの状態を読む。DB に行がなければ見本の状態を入れて返す */
export async function loadMorning(): Promise<MorningRecord> {
  if (!hasDb()) {
    g.__shimaenaMorning ??= initial();
    return g.__shimaenaMorning;
  }
  return memoRead(MEMO, loadMorningFromDb);
}

async function loadMorningFromDb(): Promise<MorningRecord> {
  try {
    const rows = await query<{ state: MorningRecord }>("select state from morning_state where key = $1", [KEY]);
    if (rows[0]) return rows[0].state;
    const s = initial();
    await saveMorning(s);
    return s;
  } catch (e) {
    fallback(e);
    g.__shimaenaMorning ??= initial();
    return g.__shimaenaMorning;
  }
}

export async function saveMorning(next: MorningRecord): Promise<void> {
  if (!hasDb()) {
    g.__shimaenaMorning = next;
    return;
  }
  try {
    await query(
      `insert into morning_state (key, state, updated_at) values ($1, $2::jsonb, now())
       on conflict (key) do update set state = excluded.state, updated_at = now()`,
      [KEY, JSON.stringify(next)],
    );
    memoPut(MEMO, next);
  } catch (e) {
    fallback(e);
    g.__shimaenaMorning = next;
  }
}

/**
 * 「作戦を立てる係」を1人だけにする。点呼が open のときだけ planned に切り替えて true を返す。
 * 同時に2か所から作戦が走って LINE が二重に届くのを防ぐ。
 */
export async function claimPlanning(): Promise<boolean> {
  if (!hasDb()) {
    const s = await loadMorning();
    if (s.morning.rollcall.status !== "open") return false;
    s.morning.rollcall.status = "planned";
    return true;
  }
  try {
    const rows = await query<{ key: string }>(
      `update morning_state set state = jsonb_set(state, '{morning,rollcall,status}', '"planned"'), updated_at = now()
       where key = $1 and state #>> '{morning,rollcall,status}' = 'open' returning key`,
      [KEY],
    );
    memoClear(MEMO); // DB を直接変えたので、同じリクエストの次の loadMorning は読み直す
    return rows.length > 0;
  } catch (e) {
    fallback(e);
    const s = await loadMorning();
    if (s.morning.rollcall.status !== "open") return false;
    s.morning.rollcall.status = "planned";
    return true;
  }
}

// ---- 朝の記録（週のまとめ用）: 日付をキーにして残す ----
const archive = globalThis as { __shimaenaArchive?: Map<string, MorningRecord> };
function mem(): Map<string, MorningRecord> {
  archive.__shimaenaArchive ??= new Map();
  return archive.__shimaenaArchive;
}

/** 今朝の記録を日付のキーで残す（次の朝を始める前に呼ぶ） */
export async function archiveMorning(record: MorningRecord): Promise<void> {
  const key = record.morning.rollcall.date;
  if (!hasDb()) {
    mem().set(key, structuredClone(record));
    return;
  }
  try {
    await query(
      `insert into morning_state (key, state, updated_at) values ($1, $2::jsonb, now())
       on conflict (key) do update set state = excluded.state, updated_at = now()`,
      [key, JSON.stringify(record)],
    );
  } catch (e) {
    fallback(e);
    mem().set(key, structuredClone(record));
  }
}

/** from 〜 to（両端を含む、YYYY-MM-DD）の朝の記録。今朝（current）も日付が合えば入る */
export async function listMornings(from: string, to: string): Promise<MorningRecord[]> {
  const byDate = new Map<string, MorningRecord>();
  if (!hasDb()) {
    for (const [k, v] of mem()) if (k >= from && k <= to) byDate.set(k, structuredClone(v));
  } else {
    try {
      const rows = await query<{ key: string; state: MorningRecord }>(
        "select key, state from morning_state where key >= $1 and key <= $2 and key <> $3 order by key",
        [from, to, KEY],
      );
      for (const r of rows) byDate.set(r.key, r.state);
    } catch (e) {
      fallback(e);
      for (const [k, v] of mem()) if (k >= from && k <= to) byDate.set(k, structuredClone(v));
    }
  }
  const current = await loadMorning();
  const d = current.morning.rollcall.date;
  if (d >= from && d <= to) byDate.set(d, current);
  return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, v]) => v);
}

export async function resetToSample(): Promise<void> {
  await saveMorning(initial());
}
