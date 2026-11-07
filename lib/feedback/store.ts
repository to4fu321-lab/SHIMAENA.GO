// 報告箱（spec v1.33）の保存先。DATABASE_URL があれば Neon の feedback_reports 表、なければメモリ（開発用）。
// 原文（text）はここと /admin にだけ残す。Issue に載るのは個人情報を除いた safe_text。
import { randomBytes } from "node:crypto";
import { hasDb, query } from "../db";
import type { FeedbackKind, FeedbackReport, FeedbackStatus, Triage } from "./rules";

const TABLE = `create table if not exists feedback_reports (
  id text primary key,
  participant_id text not null,
  kind text not null,
  text text not null,
  page text not null default '',
  status text not null default 'open',
  triaged_kind text,
  title text,
  summary text,
  safe_text text,
  issue_number integer,
  issue_url text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  checked_at timestamptz)`;
const INDEX = "create index if not exists feedback_reports_status on feedback_reports (status, created_at)";
let ready: Promise<void> | undefined;
const ensure = () =>
  (ready ??= query(TABLE)
    .then(() => query(INDEX))
    .then(() => undefined)
    .catch((e) => {
      ready = undefined;
      throw e;
    }));

const g = globalThis as { __shimaenaFeedback?: Map<string, FeedbackReport> };
const mem = () => (g.__shimaenaFeedback ??= new Map());

interface Row {
  id: string;
  participant_id: string;
  kind: FeedbackKind;
  text: string;
  page: string;
  status: FeedbackStatus;
  triaged_kind: FeedbackKind | null;
  title: string | null;
  summary: string | null;
  safe_text: string | null;
  issue_number: number | null;
  issue_url: string | null;
  note: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  checked_at: string | Date | null;
}
const COLS = "id, participant_id, kind, text, page, status, triaged_kind, title, summary, safe_text, issue_number, issue_url, note, created_at, updated_at, checked_at";
const iso = (v: string | Date) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString());
function toReport(r: Row): FeedbackReport {
  const out: FeedbackReport = { id: r.id, participantId: r.participant_id, kind: r.kind, text: r.text, page: r.page, status: r.status, at: iso(r.created_at), updatedAt: iso(r.updated_at) };
  if (r.triaged_kind) out.triagedKind = r.triaged_kind;
  if (r.title) out.title = r.title;
  if (r.summary) out.summary = r.summary;
  if (r.safe_text) out.safeText = r.safe_text;
  if (r.issue_number != null) out.issueNumber = Number(r.issue_number);
  if (r.issue_url) out.issueUrl = r.issue_url;
  if (r.note) out.note = r.note;
  if (r.checked_at) out.checkedAt = iso(r.checked_at);
  return out;
}

export async function insertFeedback(input: { participantId: string; kind: FeedbackKind; text: string; page: string }, now = new Date()): Promise<FeedbackReport> {
  const r: FeedbackReport = { id: `fb-${randomBytes(6).toString("base64url")}`, ...input, status: "open", at: now.toISOString(), updatedAt: now.toISOString() };
  if (!hasDb()) {
    mem().set(r.id, { ...r });
    return r;
  }
  await ensure();
  await query("insert into feedback_reports (id, participant_id, kind, text, page, status, created_at, updated_at) values ($1, $2, $3, $4, $5, 'open', $6, $6)", [r.id, r.participantId, r.kind, r.text, r.page, r.at]);
  return r;
}

/** Claude の仕分けを書き込む */
export async function saveTriage(id: string, t: Triage, now = new Date()): Promise<void> {
  if (!hasDb()) {
    const r = mem().get(id);
    if (r) Object.assign(r, { triagedKind: t.kind, title: t.title, summary: t.summary, safeText: t.safe, updatedAt: now.toISOString() });
    return;
  }
  await ensure();
  await query("update feedback_reports set triaged_kind = $2, title = $3, summary = $4, safe_text = $5, updated_at = $6 where id = $1", [id, t.kind, t.title, t.summary, t.safe, now.toISOString()]);
}

/** Issue が立った */
export async function markIssued(id: string, issueNumber: number, issueUrl: string, now = new Date()): Promise<void> {
  if (!hasDb()) {
    const r = mem().get(id);
    if (r) Object.assign(r, { status: "issued", issueNumber, issueUrl, updatedAt: now.toISOString(), checkedAt: now.toISOString() });
    return;
  }
  await ensure();
  await query("update feedback_reports set status = 'issued', issue_number = $2, issue_url = $3, updated_at = $4, checked_at = $4 where id = $1 and status = 'open'", [id, issueNumber, issueUrl, now.toISOString()]);
}

/** GitHub を見た（まだ開いている） */
export async function markChecked(id: string, now = new Date()): Promise<void> {
  if (!hasDb()) {
    const r = mem().get(id);
    if (r) r.checkedAt = now.toISOString();
    return;
  }
  await ensure();
  await query("update feedback_reports set checked_at = $2 where id = $1", [id, now.toISOString()]);
}

/** 直した／見送り。すでに終わっていれば false（二重に知らせない） */
export async function markOutcome(id: string, status: "done" | "skipped", note: string, now = new Date()): Promise<boolean> {
  if (!hasDb()) {
    const r = mem().get(id);
    if (!r || r.status === "done" || r.status === "skipped") return false;
    Object.assign(r, { status, note, updatedAt: now.toISOString(), checkedAt: now.toISOString() });
    return true;
  }
  await ensure();
  const rows = await query<{ id: string }>("update feedback_reports set status = $2, note = $3, updated_at = $4, checked_at = $4 where id = $1 and status in ('open', 'issued') returning id", [id, status, note, now.toISOString()]);
  return rows.length > 0;
}

export async function getFeedback(id: string): Promise<FeedbackReport | undefined> {
  if (!hasDb()) {
    const r = mem().get(id);
    return r ? { ...r } : undefined;
  }
  await ensure();
  const rows = await query<Row>(`select ${COLS} from feedback_reports where id = $1`, [id]);
  return rows[0] ? toReport(rows[0]) : undefined;
}

/** 状態で絞って、古い順 */
export async function listFeedbackByStatus(statuses: FeedbackStatus[], limit = 50): Promise<FeedbackReport[]> {
  if (!hasDb()) return [...mem().values()].filter((r) => statuses.includes(r.status)).sort((a, b) => a.at.localeCompare(b.at)).slice(0, limit).map((r) => ({ ...r }));
  await ensure();
  const rows = await query<Row>(`select ${COLS} from feedback_reports where status = any($1::text[]) order by created_at limit $2`, [statuses, limit]);
  return rows.map(toReport);
}

/** 新しい順（/admin） */
export async function listRecentFeedback(limit = 30): Promise<FeedbackReport[]> {
  if (!hasDb()) return [...mem().values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit).map((r) => ({ ...r }));
  await ensure();
  const rows = await query<Row>(`select ${COLS} from feedback_reports order by created_at desc limit $1`, [limit]);
  return rows.map(toReport);
}

/** その人が今日（JST の日付の文字で比べる）送った数 */
export async function countToday(participantId: string, sinceIso: string): Promise<number> {
  if (!hasDb()) return [...mem().values()].filter((r) => r.participantId === participantId && r.at >= sinceIso).length;
  await ensure();
  const rows = await query<{ n: string }>("select count(*)::text as n from feedback_reports where participant_id = $1 and created_at >= $2", [participantId, sinceIso]);
  return Number(rows[0]?.n ?? 0);
}
