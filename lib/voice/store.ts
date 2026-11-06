// 声を貯める（spec v1.17）: 相談の1往復ごとに Claude が読み取った「求められていること」を1件ずつ残す。
// 種類: feature（機能の要望）／confusion（分からない所）／trouble（困りごと）／praise（うれしい声）。原文・名前・体のこと・住所は残さない。
// 日曜に Claude が1週間ぶんを読んで「改善の提案」を書き、/admin の「声」タブに出す（提案の採用は本人が決める）。
// 保存先は voice_logs 表と morning_state（提案）。DB がなければメモリ。
import { randomBytes } from "node:crypto";
import { hasDb, query } from "../db";
import type { Motive } from "../concierge/profile";

export const VOICE_CATEGORIES = ["feature", "confusion", "trouble", "praise"] as const;
export type VoiceCategory = (typeof VOICE_CATEGORIES)[number];
export const VOICE_LABEL: Record<VoiceCategory, string> = { feature: "機能の要望", confusion: "分からない所", trouble: "困りごと", praise: "うれしい声" };

export interface Voice {
  id: string;
  participantId: string;
  date: string; // YYYY-MM-DD
  category: VoiceCategory;
  /** 要約（40字まで） */
  summary: string;
  motives: Motive[];
  /** そのときすすめた候補の id */
  picked?: string;
  at: string; // ISO
}

export function isVoiceCategory(x: unknown): x is VoiceCategory {
  return (VOICE_CATEGORIES as readonly string[]).includes(String(x));
}

const TABLE = `create table if not exists voice_logs (
  id text primary key,
  participant_id text not null,
  date text not null,
  category text not null,
  summary text not null,
  motives jsonb not null default '[]'::jsonb,
  picked text,
  created_at timestamptz not null default now())`;
const INDEX = "create index if not exists voice_logs_date on voice_logs (date)";
let ready: Promise<void> | undefined;
const ensure = () =>
  (ready ??= query(TABLE)
    .then(() => query(INDEX))
    .then(() => undefined)
    .catch((e) => {
      ready = undefined;
      throw e;
    }));

const g = globalThis as { __shimaenaVoices?: Voice[]; __shimaenaImprove?: Map<string, Improvement> };
const mem = () => (g.__shimaenaVoices ??= []);

export async function addVoice(v: Omit<Voice, "id" | "at">, now = new Date()): Promise<Voice> {
  const voice: Voice = { ...v, id: `v-${randomBytes(6).toString("base64url")}`, at: now.toISOString(), summary: v.summary.slice(0, 40) };
  if (!hasDb()) {
    mem().push(voice);
    return voice;
  }
  await ensure();
  await query("insert into voice_logs (id, participant_id, date, category, summary, motives, picked, created_at) values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)", [
    voice.id,
    voice.participantId,
    voice.date,
    voice.category,
    voice.summary,
    JSON.stringify(voice.motives),
    voice.picked ?? null,
    voice.at,
  ]);
  return voice;
}

/** from 〜 to（両端を含む、YYYY-MM-DD）の声（古い順） */
export async function listVoicesBetween(from: string, to: string): Promise<Voice[]> {
  if (!hasDb()) return mem().filter((v: Voice) => v.date >= from && v.date <= to).map((v: Voice) => ({ ...v }));
  await ensure();
  const rows = await query<{ id: string; participant_id: string; date: string; category: VoiceCategory; summary: string; motives: Motive[]; picked: string | null; created_at: string }>(
    "select id, participant_id, date, category, summary, motives, picked, created_at from voice_logs where date >= $1 and date <= $2 order by created_at",
    [from, to],
  );
  return rows.map((r) => ({ id: r.id, participantId: r.participant_id, date: r.date, category: r.category, summary: r.summary, motives: r.motives ?? [], ...(r.picked ? { picked: r.picked } : {}), at: new Date(r.created_at).toISOString() }));
}

/** 種類ごとの数 */
export function countByCategory(voices: Voice[]): Record<VoiceCategory, number> {
  const out: Record<VoiceCategory, number> = { feature: 0, confusion: 0, trouble: 0, praise: 0 };
  for (const v of voices) out[v.category]++;
  return out;
}

// ---- 改善の提案（Claude が1週間の声から書く。morning_state の improve:<週の始まり> に置く） ----
export interface Proposal {
  /** 提案の題（30字） */
  title: string;
  /** 元になった声の数 */
  voices: number;
  /** 直し方の案（80字） */
  change: string;
  /** 仕様のどこ（例「v1.17 隊長トーク」「5 得点」） */
  where: string;
  priority: "高" | "中" | "低";
}
export interface Improvement {
  weekStart: string;
  from: string;
  to: string;
  total: number;
  counts: Record<VoiceCategory, number>;
  proposals: Proposal[];
  at: string; // ISO
  /** Claude が書いた（false なら言葉の一覧） */
  byClaude: boolean;
}

const improveMem = () => (g.__shimaenaImprove ??= new Map());

export async function saveImprovement(imp: Improvement): Promise<void> {
  improveMem().set(imp.weekStart, imp);
  if (!hasDb()) return;
  await query(
    `insert into morning_state (key, state, updated_at) values ($1, $2::jsonb, now())
     on conflict (key) do update set state = excluded.state, updated_at = now()`,
    [`improve:${imp.weekStart}`, JSON.stringify(imp)],
  );
}

/** いちばん新しい提案（なければ undefined） */
export async function loadLatestImprovement(): Promise<Improvement | undefined> {
  if (!hasDb()) return [...improveMem().values()].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0];
  const rows = await query<{ state: Improvement }>("select state from morning_state where key like 'improve:%' order by key desc limit 1");
  return rows[0]?.state;
}
