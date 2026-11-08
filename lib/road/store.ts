// 道の報告・通知の希望・送った回数の保存先。DATABASE_URL があれば Neon、なければメモリ（開発用）。
import { hasDb, query } from "../db";
import type { HazardId, RoadReport } from "./hazards";

// 表がまだなければ、最初に使うときに作る（/admin のボタンを押し忘れても止まらないように。何度でも安全）
const TABLES = [
  `create table if not exists road_reports (
    id text primary key, participant_id text not null references participants(id), hazard text not null,
    lat double precision not null, lng double precision not null, note text, photo text,
    date text not null, at timestamptz not null, notified_at timestamptz)`,
  `create table if not exists road_alert_prefs (
    participant_id text primary key references participants(id), enabled boolean not null, updated_at timestamptz not null default now())`,
  `create table if not exists road_alert_sends (
    participant_id text not null, date text not null, count integer not null default 0, primary key (participant_id, date))`,
];
let ready: Promise<void> | undefined;
function ensure(): Promise<void> {
  ready ??= (async () => {
    for (const t of TABLES) await query(t);
  })().catch((e) => {
    ready = undefined; // 次の呼び出しでもう一度
    throw e;
  });
  return ready;
}

interface Mem {
  reports: Map<string, RoadReport & { photo?: string }>;
  prefs: Map<string, boolean>;
  sends: Map<string, number>;
}
const g = globalThis as { __shimaenaRoad?: Mem };
const mem = (): Mem => (g.__shimaenaRoad ??= { reports: new Map(), prefs: new Map(), sends: new Map() });

interface Row {
  id: string;
  participant_id: string;
  hazard: string;
  lat: number;
  lng: number;
  note: string | null;
  date: string;
  at: string | Date;
  notified_at: string | Date | null;
}
const COLS = "id, participant_id, hazard, lat, lng, note, date, at, notified_at";
const iso = (v: string | Date) => (v instanceof Date ? v.toISOString() : new Date(v).toISOString());
function toReport(r: Row): RoadReport {
  const out: RoadReport = {
    id: r.id,
    participantId: r.participant_id,
    hazard: r.hazard as HazardId,
    location: [Number(r.lat), Number(r.lng)],
    date: r.date,
    at: iso(r.at),
  };
  if (r.note) out.note = r.note;
  if (r.notified_at) out.notifiedAt = iso(r.notified_at);
  return out;
}

export async function insertRoadReport(r: RoadReport, photoBase64?: string): Promise<void> {
  if (!hasDb()) {
    mem().reports.set(r.id, { ...r, photo: photoBase64 });
    return;
  }
  await ensure();
  await query(
    `insert into road_reports (id, participant_id, hazard, lat, lng, note, photo, date, at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [r.id, r.participantId, r.hazard, r.location[0], r.location[1], r.note ?? null, photoBase64 ?? null, r.date, r.at],
  );
}

/** since（ISO）より後の報告。新しい順 */
export async function listRoadReportsSince(since: string): Promise<RoadReport[]> {
  if (!hasDb()) {
    return [...mem().reports.values()]
      .filter((r) => r.at > since)
      .map((r) => {
        const out: RoadReport & { photo?: string } = { ...r };
        delete out.photo;
        return out;
      })
      .sort((a, b) => b.at.localeCompare(a.at));
  }
  await ensure();
  const rows = await query<Row>(`select ${COLS} from road_reports where at > $1 order by at desc`, [since]);
  return rows.map(toReport);
}

/** 撮影ステージ用: その人の道の報告を消す（前の撮影のピンが残らないように） */
export async function deleteRoadReportsBy(participantId: string): Promise<void> {
  if (!hasDb()) {
    for (const [id, r] of mem().reports) if (r.participantId === participantId) mem().reports.delete(id);
    return;
  }
  await ensure();
  await query("delete from road_reports where participant_id = $1", [participantId]);
}

export async function roadPhoto(id: string): Promise<string | undefined> {
  if (!hasDb()) return mem().reports.get(id)?.photo;
  await ensure();
  const rows = await query<{ photo: string | null }>("select photo from road_reports where id = $1", [id]);
  return rows[0]?.photo ?? undefined;
}

export async function markNotified(id: string, at: string): Promise<void> {
  if (!hasDb()) {
    const r = mem().reports.get(id);
    if (r) r.notifiedAt = at;
    return;
  }
  await ensure();
  await query("update road_reports set notified_at = $2 where id = $1", [id, at]);
}

// ---- 通知の希望（未回答は undefined） ----
export async function getAlertPref(participantId: string): Promise<boolean | undefined> {
  if (!hasDb()) return mem().prefs.get(participantId);
  await ensure();
  const rows = await query<{ enabled: boolean }>("select enabled from road_alert_prefs where participant_id = $1", [participantId]);
  return rows[0]?.enabled;
}

export async function setAlertPref(participantId: string, enabled: boolean): Promise<void> {
  if (!hasDb()) {
    mem().prefs.set(participantId, enabled);
    return;
  }
  await ensure();
  await query(
    `insert into road_alert_prefs (participant_id, enabled, updated_at) values ($1, $2, now())
     on conflict (participant_id) do update set enabled = excluded.enabled, updated_at = now()`,
    [participantId, enabled],
  );
}

/** 受け取るにした人の ID */
export async function listAlertOn(): Promise<Set<string>> {
  if (!hasDb()) return new Set([...mem().prefs].filter(([, on]) => on).map(([id]) => id));
  await ensure();
  const rows = await query<{ participant_id: string }>("select participant_id from road_alert_prefs where enabled");
  return new Set(rows.map((r) => r.participant_id));
}

// ---- 送った回数（1日3回まで） ----
export async function sendCounts(date: string): Promise<Map<string, number>> {
  if (!hasDb()) {
    const out = new Map<string, number>();
    for (const [k, n] of mem().sends) if (k.endsWith(`|${date}`)) out.set(k.split("|")[0], n);
    return out;
  }
  await ensure();
  const rows = await query<{ participant_id: string; count: number }>("select participant_id, count from road_alert_sends where date = $1", [date]);
  return new Map(rows.map((r) => [r.participant_id, Number(r.count)]));
}

export async function addSend(participantId: string, date: string): Promise<void> {
  if (!hasDb()) {
    const k = `${participantId}|${date}`;
    mem().sends.set(k, (mem().sends.get(k) ?? 0) + 1);
    return;
  }
  await ensure();
  await query(
    `insert into road_alert_sends (participant_id, date, count) values ($1, $2, 1)
     on conflict (participant_id, date) do update set count = road_alert_sends.count + 1`,
    [participantId, date],
  );
}
