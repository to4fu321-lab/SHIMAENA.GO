// なかま機能の保存先（spec v1.13）。DATABASE_URL があれば Neon、なければメモリ（開発用）。
// 表は足すだけ（今の表には触らない）。表がまだなければ最初に使うときに作る（何度でも安全）。
import { hasDb, query } from "../db";
import type { Baton, BatonReaction, Meetup, NakamaPref, NextWish, TodayMode } from "./rules";

const TABLES = [
  `create table if not exists nakama_prefs (
    participant_id text primary key, next_wish text, today_mode text, today_date text, today_at timestamptz,
    updated_at timestamptz not null default now())`,
  `create table if not exists meetups (
    id text primary key, date text not null, from_id text not null, to_id text not null, kind text not null,
    win text not null, base_number smallint, mission_id text, status text not null, message text not null,
    created_at timestamptz not null, responded_at timestamptz)`,
  `create index if not exists meetups_date on meetups (date)`,
  `create table if not exists batons (
    id text primary key, participant_id text not null, date text not null, area text not null, source text not null,
    status text not null, message text not null, photo_checked boolean not null default false, story text,
    at timestamptz not null)`,
  `create index if not exists batons_area on batons (date, area)`,
  `create table if not exists baton_reactions (
    baton_id text not null, participant_id text not null, reaction text not null, at timestamptz not null default now(),
    primary key (baton_id, participant_id))`,
];
let ready: Promise<void> | undefined;
function ensure(): Promise<void> {
  ready ??= (async () => {
    for (const t of TABLES) await query(t);
  })().catch((e) => {
    ready = undefined;
    throw e;
  });
  return ready;
}

interface Mem {
  prefs: Map<string, NakamaPref>;
  meetups: Map<string, Meetup>;
  batons: Map<string, Baton>;
  reactions: Map<string, Map<string, BatonReaction>>; // baton → (参加者 → リアクション)
}
const g = globalThis as { __shimaenaNakama?: Mem };
const mem = (): Mem => (g.__shimaenaNakama ??= { prefs: new Map(), meetups: new Map(), batons: new Map(), reactions: new Map() });

/** テスト用: メモリを空にする */
export function resetNakamaMemory(): void {
  g.__shimaenaNakama = undefined;
}

const iso = (v: string | Date | null | undefined) => (v == null ? undefined : v instanceof Date ? v.toISOString() : new Date(v).toISOString());

// ---- 交流の希望 ----

interface PrefRow {
  participant_id: string;
  next_wish: string | null;
  today_mode: string | null;
  today_date: string | null;
  today_at: string | Date | null;
}
function toPref(r: PrefRow): NakamaPref {
  const p: NakamaPref = { participantId: r.participant_id };
  if (r.next_wish) p.nextWish = r.next_wish as NextWish;
  if (r.today_mode) p.todayMode = r.today_mode as TodayMode;
  if (r.today_date) p.todayDate = r.today_date;
  const at = iso(r.today_at);
  if (at) p.todayAt = at;
  return p;
}

export async function getPref(participantId: string): Promise<NakamaPref | undefined> {
  if (!hasDb()) return mem().prefs.get(participantId);
  await ensure();
  const rows = await query<PrefRow>("select * from nakama_prefs where participant_id = $1", [participantId]);
  return rows[0] ? toPref(rows[0]) : undefined;
}

/** 今日のスタイルを選んだ人（その日のぶんだけ） */
export async function listPrefsOn(date: string): Promise<NakamaPref[]> {
  if (!hasDb()) return [...mem().prefs.values()].filter((p) => p.todayDate === date);
  await ensure();
  const rows = await query<PrefRow>("select * from nakama_prefs where today_date = $1", [date]);
  return rows.map(toPref);
}

export async function setTodayModeRow(participantId: string, mode: TodayMode, date: string, at: string): Promise<void> {
  if (!hasDb()) {
    const cur = mem().prefs.get(participantId) ?? { participantId };
    mem().prefs.set(participantId, { ...cur, todayMode: mode, todayDate: date, todayAt: at });
    return;
  }
  await ensure();
  await query(
    `insert into nakama_prefs (participant_id, today_mode, today_date, today_at, updated_at) values ($1, $2, $3, $4, now())
     on conflict (participant_id) do update set today_mode = excluded.today_mode, today_date = excluded.today_date,
       today_at = excluded.today_at, updated_at = now()`,
    [participantId, mode, date, at],
  );
}

export async function setNextWishRow(participantId: string, wish: NextWish): Promise<void> {
  if (!hasDb()) {
    const cur = mem().prefs.get(participantId) ?? { participantId };
    mem().prefs.set(participantId, { ...cur, nextWish: wish });
    return;
  }
  await ensure();
  await query(
    `insert into nakama_prefs (participant_id, next_wish, updated_at) values ($1, $2, now())
     on conflict (participant_id) do update set next_wish = excluded.next_wish, updated_at = now()`,
    [participantId, wish],
  );
}

// ---- 合流の提案 ----

interface MeetRow {
  id: string;
  date: string;
  from_id: string;
  to_id: string;
  kind: string;
  win: string;
  base_number: number | null;
  mission_id: string | null;
  status: string;
  message: string;
  created_at: string | Date;
  responded_at: string | Date | null;
}
function toMeetup(r: MeetRow): Meetup {
  const m: Meetup = {
    id: r.id,
    date: r.date,
    fromId: r.from_id,
    toId: r.to_id,
    kind: r.kind as Meetup["kind"],
    window: r.win as Meetup["window"],
    status: r.status as Meetup["status"],
    message: r.message,
    createdAt: iso(r.created_at)!,
  };
  if (r.base_number != null) m.baseNumber = Number(r.base_number);
  if (r.mission_id) m.missionId = r.mission_id;
  const resp = iso(r.responded_at);
  if (resp) m.respondedAt = resp;
  return m;
}

export async function insertMeetup(m: Meetup): Promise<void> {
  if (!hasDb()) {
    mem().meetups.set(m.id, m);
    return;
  }
  await ensure();
  await query(
    `insert into meetups (id, date, from_id, to_id, kind, win, base_number, mission_id, status, message, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [m.id, m.date, m.fromId, m.toId, m.kind, m.window, m.baseNumber ?? null, m.missionId ?? null, m.status, m.message, m.createdAt],
  );
}

export async function getMeetup(id: string): Promise<Meetup | undefined> {
  if (!hasDb()) return mem().meetups.get(id);
  await ensure();
  const rows = await query<MeetRow>("select * from meetups where id = $1", [id]);
  return rows[0] ? toMeetup(rows[0]) : undefined;
}

/** 返事を書く。まだ「提案中」のときだけ書き換える（同時に押されても1回だけ） */
export async function updateMeetupStatus(id: string, status: Meetup["status"], at: string): Promise<boolean> {
  if (!hasDb()) {
    const m = mem().meetups.get(id);
    if (!m || m.status !== "proposed") return false;
    mem().meetups.set(id, { ...m, status, respondedAt: at });
    return true;
  }
  await ensure();
  const rows = await query<{ id: string }>(
    "update meetups set status = $2, responded_at = $3 where id = $1 and status = 'proposed' returning id",
    [id, status, at],
  );
  return rows.length > 0;
}

/** その人が関わる提案（since の日付から） */
export async function listMeetupsFor(participantId: string, since: string): Promise<Meetup[]> {
  if (!hasDb()) {
    return [...mem().meetups.values()]
      .filter((m) => (m.fromId === participantId || m.toId === participantId) && m.date >= since)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  await ensure();
  const rows = await query<MeetRow>(
    "select * from meetups where (from_id = $1 or to_id = $1) and date >= $2 order by created_at desc",
    [participantId, since],
  );
  return rows.map(toMeetup);
}

/** その日に、その人が受け取った誘いの数 */
export async function countIncoming(participantId: string, date: string): Promise<number> {
  if (!hasDb()) return [...mem().meetups.values()].filter((m) => m.toId === participantId && m.date === date).length;
  await ensure();
  const rows = await query<{ n: string }>("select count(*)::text as n from meetups where to_id = $1 and date = $2", [participantId, date]);
  return Number(rows[0]?.n ?? 0);
}

// ---- バトン ----

interface BatonRow {
  id: string;
  participant_id: string;
  date: string;
  area: string;
  source: string;
  status: string;
  message: string;
  photo_checked: boolean;
  story: string | null;
  at: string | Date;
}
function toBaton(r: BatonRow): Baton {
  const b: Baton = {
    id: r.id,
    participantId: r.participant_id,
    date: r.date,
    area: r.area,
    source: r.source as Baton["source"],
    status: r.status as Baton["status"],
    message: r.message,
    photoChecked: Boolean(r.photo_checked),
    at: iso(r.at)!,
  };
  if (r.story) b.story = r.story;
  return b;
}

export async function insertBaton(b: Baton): Promise<void> {
  if (!hasDb()) {
    mem().batons.set(b.id, b);
    return;
  }
  await ensure();
  await query(
    `insert into batons (id, participant_id, date, area, source, status, message, photo_checked, story, at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [b.id, b.participantId, b.date, b.area, b.source, b.status, b.message, b.photoChecked, b.story ?? null, b.at],
  );
}

/** その日・その地域のバトン（古い順） */
export async function listBatons(date: string, area: string): Promise<Baton[]> {
  if (!hasDb()) {
    return [...mem().batons.values()].filter((b) => b.date === date && b.area === area).sort((a, b) => a.at.localeCompare(b.at));
  }
  await ensure();
  const rows = await query<BatonRow>("select * from batons where date = $1 and area = $2 order by at", [date, area]);
  return rows.map(toBaton);
}

export async function getBaton(id: string): Promise<Baton | undefined> {
  if (!hasDb()) return mem().batons.get(id);
  await ensure();
  const rows = await query<BatonRow>("select * from batons where id = $1", [id]);
  return rows[0] ? toBaton(rows[0]) : undefined;
}

/** リアクション（1人1回。押し直したら新しいほう） */
export async function setReaction(batonId: string, participantId: string, reaction: BatonReaction): Promise<void> {
  if (!hasDb()) {
    const m = mem().reactions.get(batonId) ?? new Map();
    m.set(participantId, reaction);
    mem().reactions.set(batonId, m);
    return;
  }
  await ensure();
  await query(
    `insert into baton_reactions (baton_id, participant_id, reaction) values ($1, $2, $3)
     on conflict (baton_id, participant_id) do update set reaction = excluded.reaction, at = now()`,
    [batonId, participantId, reaction],
  );
}

/** バトンごとのリアクションの数と、ある人が押したもの */
export async function reactionsOf(
  batonIds: string[],
  viewerId?: string,
): Promise<Map<string, { thanks: number; continue: number; mine?: BatonReaction }>> {
  const out = new Map<string, { thanks: number; continue: number; mine?: BatonReaction }>();
  for (const id of batonIds) out.set(id, { thanks: 0, continue: 0 });
  if (batonIds.length === 0) return out;
  let rows: { baton_id: string; participant_id: string; reaction: string }[];
  if (!hasDb()) {
    rows = batonIds.flatMap((id) => [...(mem().reactions.get(id) ?? new Map<string, BatonReaction>())].map(([pid, r]) => ({ baton_id: id, participant_id: pid, reaction: r })));
  } else {
    await ensure();
    rows = await query("select baton_id, participant_id, reaction from baton_reactions where baton_id = any($1)", [batonIds]);
  }
  for (const r of rows) {
    const c = out.get(r.baton_id);
    if (!c) continue;
    if (r.reaction === "thanks") c.thanks++;
    else if (r.reaction === "continue") c.continue++;
    if (viewerId && r.participant_id === viewerId) c.mine = r.reaction as BatonReaction;
  }
  return out;
}

/** その人が書いたバトン（since の日付から。新しい順） */
export async function listBatonsBy(participantId: string, since: string): Promise<Baton[]> {
  if (!hasDb()) {
    return [...mem().batons.values()].filter((b) => b.participantId === participantId && b.date >= since).sort((a, b) => b.at.localeCompare(a.at));
  }
  await ensure();
  const rows = await query<BatonRow>("select * from batons where participant_id = $1 and date >= $2 order by at desc", [participantId, since]);
  return rows.map(toBaton);
}
