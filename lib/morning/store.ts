// 「今朝の状態」の保存先。DATABASE_URL があれば Neon の morning_state 表に JSON でまるごと置く。
// ない間はサーバーのメモリに持つ（開発用。Vercel ではリクエストごとに別のサーバーになるので DB が要る）。
import { hasDb, query } from "../db";
import { memoClear, memoPut, memoRead } from "../db/memo";
import { isDeployed } from "../env";
import { recordProblem } from "../ops/problems";
import type { MorningRecord } from "./flow";
import { emptyMorning } from "./flow";
import { DEMO_MORNING } from "./sample";
import { jstDate } from "../jst";
import { isRealWorld } from "../world";

const g = globalThis as { __shimaenaMorning?: MorningRecord; __shimaenaMorningReal?: MorningRecord };
/** サンプルの町（と、町を決めていない昔からの入口）の行。本番の町は REAL_KEY（spec v1.70） */
const SAMPLE_KEY = "current";
const REAL_KEY = "real";
const key = () => (isRealWorld() ? REAL_KEY : SAMPLE_KEY);
/** 残した朝の記録の鍵: サンプルは日付そのまま（今まで通り）、本番は real:日付 */
const archiveKey = (date: string) => (isRealWorld() ? `${REAL_KEY}:${date}` : date);

/** 本番の町の最初: 雪の知らせのない、ふつうの日（予告も作戦もない）。雪が積もった朝に、定期実行が始める */
export function quietDay(date = jstDate()): MorningRecord {
  const s = emptyMorning({ date, forecastCm: 0, announcement: "いまは、雪かきのお知らせはありません。" });
  s.morning.rollcall.status = "closed";
  s.morning.viewerId = "";
  s.log = ["本番の町を始めました（本当の天気で動きます）"];
  return s;
}

/** 最初は「朝 7:10 ごろの途中の状態」（地図を開いたとき見栄えがするように）。本番の町は、ふつうの日から */
function initial(): MorningRecord {
  if (isRealWorld()) return quietDay();
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
const memo = () => `morning:${key()}`;
/** DB がない間の置き場（町ごと） */
const memGet = (): MorningRecord | undefined => (isRealWorld() ? g.__shimaenaMorningReal : g.__shimaenaMorning);
const memSet = (v: MorningRecord): MorningRecord => (isRealWorld() ? (g.__shimaenaMorningReal = v) : (g.__shimaenaMorning = v));

/** いまの状態を読む。DB に行がなければ見本の状態を入れて返す */
export async function loadMorning(): Promise<MorningRecord> {
  if (!hasDb()) {
    return memGet() ?? memSet(initial());
  }
  return memoRead(memo(), loadMorningFromDb);
}

async function loadMorningFromDb(): Promise<MorningRecord> {
  try {
    const rows = await query<{ state: MorningRecord }>("select state from morning_state where key = $1", [key()]);
    if (rows[0]) return rows[0].state;
    const s = initial();
    await saveMorning(s);
    return s;
  } catch (e) {
    fallback(e);
    return memGet() ?? memSet(initial());
  }
}

export async function saveMorning(next: MorningRecord): Promise<void> {
  if (!hasDb()) {
    memSet(next);
    return;
  }
  try {
    await query(
      `insert into morning_state (key, state, updated_at) values ($1, $2::jsonb, now())
       on conflict (key) do update set state = excluded.state, updated_at = now()`,
      [key(), JSON.stringify(next)],
    );
    memoPut(memo(), next);
  } catch (e) {
    fallback(e);
    memSet(next);
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
      [key()],
    );
    memoClear(memo()); // DB を直接変えたので、同じリクエストの次の loadMorning は読み直す
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
  const key = archiveKey(record.morning.rollcall.date);
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
  // 鍵は、サンプルなら日付そのまま・本番なら real:日付（町ごとに別の記録）。日付は rollcall.date から取る
  const [lo, hi] = [archiveKey(from), archiveKey(to)];
  const fromMem = () => {
    for (const [k, v] of mem()) if (k >= lo && k <= hi) byDate.set(v.morning.rollcall.date, structuredClone(v));
  };
  if (!hasDb()) fromMem();
  else {
    try {
      const rows = await query<{ key: string; state: MorningRecord }>(
        "select key, state from morning_state where key >= $1 and key <= $2 and key <> $3 and key <> $4 order by key",
        [lo, hi, SAMPLE_KEY, REAL_KEY],
      );
      for (const r of rows) byDate.set(r.state.morning.rollcall.date, r.state);
    } catch (e) {
      fallback(e);
      fromMem();
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
