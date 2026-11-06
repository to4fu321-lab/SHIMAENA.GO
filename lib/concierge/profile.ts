// その人が何を求めているか（spec v1.17）: 4つの方向（つながり・運動・地域貢献・ゲーム）と、短い要約（40字）。
// 相談のたびに Claude が読み取り、ここに残す（原文・名前・体のこと・住所は残さない）。方向はいつでも変わってよい（新しい相談で上書き）。
// 保存先は participant_profiles 表。DB がなければメモリ。
import { hasDb, query } from "../db";

export const MOTIVES = ["connect", "exercise", "community", "game"] as const;
export type Motive = (typeof MOTIVES)[number];

export const MOTIVE_LABEL: Record<Motive, string> = { connect: "つながり", exercise: "運動", community: "地域貢献", game: "ゲーム" };

export interface Profile {
  motives: Motive[];
  /** 求めていることの要約（40字まで） */
  summary: string;
  updatedAt: string; // ISO
}

export const SUMMARY_MAX = 40;

export function isMotive(x: unknown): x is Motive {
  return (MOTIVES as readonly string[]).includes(String(x));
}

/** 方向の並びを、使ってよい形に（知らない値は落とす・重複は1つに・4つまで） */
export function tidyMotives(xs: unknown): Motive[] {
  if (!Array.isArray(xs)) return [];
  return [...new Set(xs.filter(isMotive))].slice(0, 4);
}

const TABLE = `create table if not exists participant_profiles (
  participant_id text primary key,
  motives jsonb not null default '[]'::jsonb,
  summary text not null default '',
  updated_at timestamptz not null default now())`;
let ready: Promise<void> | undefined;
const ensure = () =>
  (ready ??= query(TABLE)
    .then(() => undefined)
    .catch((e) => {
      ready = undefined;
      throw e;
    }));

const g = globalThis as { __shimaenaProfiles?: Map<string, Profile> };
const mem = () => (g.__shimaenaProfiles ??= new Map());

export async function loadProfile(participantId: string): Promise<Profile | undefined> {
  if (!hasDb()) return mem().get(participantId);
  await ensure();
  const rows = await query<{ motives: unknown; summary: string; updated_at: string }>("select motives, summary, updated_at from participant_profiles where participant_id = $1", [participantId]);
  const r = rows[0];
  return r ? { motives: tidyMotives(r.motives), summary: r.summary ?? "", updatedAt: new Date(r.updated_at).toISOString() } : undefined;
}

/** 新しく読み取れた方向があれば入れ替え、なければ前のまま。要約も同じ */
export async function updateProfile(participantId: string, next: { motives: Motive[]; summary: string }, now = new Date()): Promise<Profile> {
  const before = await loadProfile(participantId).catch(() => undefined);
  const motives = next.motives.length > 0 ? tidyMotives(next.motives) : (before?.motives ?? []);
  const summary = (next.summary.trim() || before?.summary || "").slice(0, SUMMARY_MAX);
  const p: Profile = { motives, summary, updatedAt: now.toISOString() };
  if (!hasDb()) {
    mem().set(participantId, p);
    return p;
  }
  await ensure();
  await query(
    `insert into participant_profiles (participant_id, motives, summary, updated_at) values ($1, $2::jsonb, $3, $4)
     on conflict (participant_id) do update set motives = excluded.motives, summary = excluded.summary, updated_at = excluded.updated_at`,
    [participantId, JSON.stringify(motives), summary, p.updatedAt],
  );
  return p;
}

/** ことばから方向を読む（キーがないとき・Claude の答えの点検用）。見つからなければ空 */
export function motivesFromText(text: string): Motive[] {
  const t = text.replace(/\s+/g, "");
  const out: Motive[] = [];
  if (/つなが|仲間|なかま|友だち|友達|一緒|いっしょ|知り合|話し相手|さびし|寂し|ひとりぼっち|交流/.test(t)) out.push("connect");
  if (/運動|体を動か|からだを動か|汗|健康|歩き|散歩|筋|ダイエット|運動不足|体力/.test(t)) out.push("exercise");
  if (/地域|町内|貢献|役に(も)?立|やくに(も)?立|助けたい|恩返し|困っている人|お年寄り|高齢|ボランティア/.test(t)) out.push("community");
  if (/ゲーム|ポイント|点数|得点|カード|図鑑|レア|ランキング|順位|称号|連続|チーム戦|勝ち/.test(t)) out.push("game");
  return out;
}
