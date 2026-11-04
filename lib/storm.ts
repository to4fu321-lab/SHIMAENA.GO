// 警報の日はゲームをお休みにする（spec v1.11、11/4 本人の指示「猛吹雪で警報クラスが出たら、そのエリアはゲームストップ」）。
// 気象庁の警報・注意報（JSON、キー不要）を見て、町のある市区町村に「暴風雪・暴風・大雪」の警報か特別警報が出ていたら止める。
// 決めるのはプログラムだけ（AI は使わない）。/admin の「お休みにする」でも止められる（訓練・デモ用）。
import { hasDb, query } from "./db";
import { recordProblem } from "./ops/problems";

/** 気象庁の地方（石狩・空知・後志地方）と市区町村（札幌市）。町を変えるときは環境変数で */
export const JMA_OFFICE = process.env.JMA_OFFICE_CODE ?? "016000";
export const JMA_AREA = process.env.JMA_AREA_CODE ?? "0110000";

/** 止める警報（気象庁のコード → 名前）。注意報では止めない */
export const STOP_WARNINGS: Record<string, string> = {
  "02": "暴風雪警報",
  "05": "暴風警報",
  "06": "大雪警報",
  "32": "暴風雪特別警報",
  "35": "暴風特別警報",
  "36": "大雪特別警報",
};

export interface StormStatus {
  stopped: boolean;
  /** 出ている警報の名前（例: 暴風雪警報）。手動で止めたときは空 */
  names: string[];
  source: "jma" | "manual" | "none";
}

interface JmaWarningJson {
  areaTypes?: { areas?: { code?: string; warnings?: { code?: string; status?: string }[] }[] }[];
}

/** 気象庁の JSON から、その市区町村に出ている「止める警報」の名前を取り出す（解除されたものは除く） */
export function stopWarnings(json: JmaWarningJson, area: string = JMA_AREA): string[] {
  const names = new Set<string>();
  for (const t of json.areaTypes ?? []) {
    for (const a of t.areas ?? []) {
      if (a.code !== area) continue;
      for (const w of a.warnings ?? []) {
        if (w.code && STOP_WARNINGS[w.code] && w.status !== "解除") names.add(STOP_WARNINGS[w.code]);
      }
    }
  }
  return [...names];
}

const CACHE_MS = 10 * 60 * 1000;
const g = globalThis as { __shimaenaStorm?: { at: number; names: string[] }; __shimaenaStormManual?: boolean; __shimaenaStormNotice?: Set<string> };

/** 気象庁を見る（10分は覚えておく）。見られなかったら前の結果、それもなければ「出ていない」 */
async function jmaNames(fetchFn: typeof fetch = fetch): Promise<string[]> {
  const c = g.__shimaenaStorm;
  if (c && Date.now() - c.at < CACHE_MS) return c.names;
  try {
    const res = await fetchFn(`https://www.jma.go.jp/bosai/warning/data/warning/${JMA_OFFICE}.json`, { cache: "no-store" });
    if (!res.ok) throw new Error(`気象庁が ${res.status} を返しました`);
    const names = stopWarnings((await res.json()) as JmaWarningJson);
    g.__shimaenaStorm = { at: Date.now(), names };
    return names;
  } catch (e) {
    await recordProblem("storm/jma", e);
    if (c) g.__shimaenaStorm = { at: Date.now(), names: c.names };
    return c?.names ?? [];
  }
}

const MANUAL_KEY = "storm_manual";

export async function manualStop(): Promise<boolean> {
  if (!hasDb()) return Boolean(g.__shimaenaStormManual);
  try {
    const rows = await query<{ stopped: boolean }>("select coalesce((state->>'on')::boolean, false) as stopped from morning_state where key = $1", [MANUAL_KEY]);
    return Boolean(rows[0]?.stopped);
  } catch {
    return false;
  }
}

/** /admin の「お休みにする／再開する」 */
export async function setManualStop(on: boolean): Promise<void> {
  g.__shimaenaStormManual = on;
  if (!hasDb()) return;
  await query(
    `insert into morning_state (key, state, updated_at) values ($1, $2::jsonb, now())
     on conflict (key) do update set state = excluded.state, updated_at = now()`,
    [MANUAL_KEY, JSON.stringify({ on })],
  );
}

/** いまゲームを止めるか */
export async function stormStatus(fetchFn: typeof fetch = fetch): Promise<StormStatus> {
  const [manual, names] = await Promise.all([manualStop(), jmaNames(fetchFn)]);
  if (names.length > 0) return { stopped: true, names, source: "jma" };
  if (manual) return { stopped: true, names: [], source: "manual" };
  return { stopped: false, names: [], source: "none" };
}

/** 画面と LINE で使う、お休みの見出し */
export function stormHeadline(s: StormStatus): string {
  return s.names.length > 0 ? `${s.names.join("・")}が出ています` : "荒れた天気のため、お休みにしています";
}

/** お休みの決まった文（AI には書かせない） */
export const STORM_LINES = [
  "きょうのシマエナGOはお休みです。",
  "雪かき・見回り・道の報告はせず、家の中で過ごしてください。",
  "警報が解除されたら、また再開します。",
] as const;

/** 画面のボタン用: お休みならその1行（ふだんは undefined） */
export async function stormStopText(): Promise<string | undefined> {
  const s = await stormStatus();
  return s.stopped ? `⛔ ${stormHeadline(s)}。${STORM_LINES[0]}${STORM_LINES[1]}` : undefined;
}

/** お休みのお知らせを、その日に1回だけ送るための印（初めてなら true） */
export async function firstStormNotice(date: string): Promise<boolean> {
  const key = `storm_notice:${date}`;
  if (!hasDb()) {
    const seen = (g.__shimaenaStormNotice ??= new Set());
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }
  try {
    const rows = await query<{ key: string }>(
      `insert into morning_state (key, state, updated_at) values ($1, '{}'::jsonb, now()) on conflict (key) do nothing returning key`,
      [key],
    );
    return rows.length > 0;
  } catch (e) {
    await recordProblem("storm/notice", e);
    return false;
  }
}

/** テスト用: 覚えている結果を消す */
export function resetStormCache(): void {
  g.__shimaenaStorm = undefined;
  g.__shimaenaStormManual = undefined;
  g.__shimaenaStormNotice = undefined;
}
