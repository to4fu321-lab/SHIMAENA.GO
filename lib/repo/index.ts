// 参加者・拠点・家族の紐づけ・LINE の登録途中経過の保存先。
// DATABASE_URL があれば Neon、なければメモリ（開発用）。素の SQL だけ。
import { hasDb, query } from "../db";
import type { RegSession } from "../line/registration";
import { TOWN } from "../town";
import type { Base, FamilyLink, Participant, TeamId } from "../types";

export interface Repo {
  findParticipantByLineUserId(lineUserId: string): Promise<Participant | undefined>;
  findParticipant(id: string): Promise<Participant | undefined>;
  upsertParticipant(p: Participant): Promise<void>;
  countHelpersByTeam(): Promise<Record<TeamId, number>>;
  findBaseByRequester(requesterId: string): Promise<Base | undefined>;
  nextBaseNumber(): Promise<number>;
  upsertBase(b: Base): Promise<void>;
  addFamilyLink(link: FamilyLink): Promise<void>;
  findFamilyLinkByCode(code: string): Promise<FamilyLink | undefined>;
  getSession(lineUserId: string): Promise<RegSession | undefined>;
  setSession(lineUserId: string, session: RegSession | null): Promise<void>;
}

// ---- メモリ ----
interface Mem {
  participants: Map<string, Participant>;
  bases: Map<string, Base>;
  links: FamilyLink[];
  sessions: Map<string, RegSession>;
}
const g = globalThis as { __shimaenaRepo?: Mem };
function mem(): Mem {
  g.__shimaenaRepo ??= {
    participants: new Map(TOWN.participants.map((p) => [p.id, structuredClone(p)])),
    bases: new Map(TOWN.bases.map((b) => [b.id, structuredClone(b)])),
    links: [],
    sessions: new Map(),
  };
  return g.__shimaenaRepo;
}

const EMPTY_COUNTS = (): Record<TeamId, number> => ({ salvia: 0, marigold: 0, lupinus: 0 });

export const memoryRepo: Repo = {
  async findParticipantByLineUserId(lineUserId) {
    return [...mem().participants.values()].find((p) => p.lineUserId === lineUserId);
  },
  async findParticipant(id) {
    return mem().participants.get(id);
  },
  async upsertParticipant(p) {
    mem().participants.set(p.id, structuredClone(p));
  },
  async countHelpersByTeam() {
    const counts = EMPTY_COUNTS();
    for (const p of mem().participants.values()) if (p.role === "helper" && p.teamId) counts[p.teamId]++;
    return counts;
  },
  async findBaseByRequester(requesterId) {
    return [...mem().bases.values()].find((b) => b.requesterId === requesterId);
  },
  async nextBaseNumber() {
    return Math.max(0, ...[...mem().bases.values()].map((b) => b.number)) + 1;
  },
  async upsertBase(b) {
    mem().bases.set(b.id, structuredClone(b));
  },
  async addFamilyLink(link) {
    const links = mem().links;
    const i = links.findIndex((l) => l.familyLineUserId === link.familyLineUserId && l.requesterId === link.requesterId);
    if (i >= 0) links[i] = link;
    else links.push(link);
  },
  async findFamilyLinkByCode(code) {
    return mem().links.find((l) => l.linkCode === code);
  },
  async getSession(lineUserId) {
    return mem().sessions.get(lineUserId);
  },
  async setSession(lineUserId, session) {
    if (session) mem().sessions.set(lineUserId, session);
    else mem().sessions.delete(lineUserId);
  },
};

// ---- Neon ----
interface ParticipantRow {
  id: string;
  nickname: string;
  role: "requester" | "helper";
  lat: number;
  lng: number;
  line_user_id: string | null;
  team_id: TeamId | null;
  solo_minutes: string | null;
  clear_area: string | null;
  level: number | null;
  morning_minutes: number | null;
  has_tools: boolean | null;
  registered_by_family_id: string | null;
}

function rowToParticipant(r: ParticipantRow): Participant {
  const p: Participant = { id: r.id, nickname: r.nickname, role: r.role, location: [Number(r.lat), Number(r.lng)] };
  if (r.line_user_id) p.lineUserId = r.line_user_id;
  if (r.team_id) p.teamId = r.team_id;
  if (r.solo_minutes) p.soloMinutes = r.solo_minutes === "unknown" ? "unknown" : (Number(r.solo_minutes) as 15 | 30 | 60);
  if (r.clear_area) p.clearArea = r.clear_area as Participant["clearArea"];
  if (r.level) p.level = r.level as 1 | 2 | 3;
  if (r.morning_minutes) p.morningMinutes = r.morning_minutes as 15 | 30 | 60;
  if (r.has_tools != null) p.hasTools = r.has_tools;
  if (r.registered_by_family_id) p.registeredByFamilyId = r.registered_by_family_id;
  return p;
}

const PARTICIPANT_COLS =
  "id, nickname, role, lat, lng, line_user_id, team_id, solo_minutes, clear_area, level, morning_minutes, has_tools, registered_by_family_id";

export const dbRepo: Repo = {
  async findParticipantByLineUserId(lineUserId) {
    const rows = await query<ParticipantRow>(`select ${PARTICIPANT_COLS} from participants where line_user_id = $1`, [lineUserId]);
    return rows[0] ? rowToParticipant(rows[0]) : undefined;
  },
  async findParticipant(id) {
    const rows = await query<ParticipantRow>(`select ${PARTICIPANT_COLS} from participants where id = $1`, [id]);
    return rows[0] ? rowToParticipant(rows[0]) : undefined;
  },
  async upsertParticipant(p) {
    await query(
      `insert into participants
         (id, nickname, role, lat, lng, line_user_id, team_id, solo_minutes, clear_area, level, morning_minutes, has_tools, registered_by_family_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       on conflict (id) do update set
         nickname = excluded.nickname, role = excluded.role, lat = excluded.lat, lng = excluded.lng,
         line_user_id = excluded.line_user_id, team_id = excluded.team_id, solo_minutes = excluded.solo_minutes,
         clear_area = excluded.clear_area, level = excluded.level, morning_minutes = excluded.morning_minutes,
         has_tools = excluded.has_tools, registered_by_family_id = excluded.registered_by_family_id`,
      [
        p.id,
        p.nickname,
        p.role,
        p.location[0],
        p.location[1],
        p.lineUserId ?? null,
        p.teamId ?? null,
        p.soloMinutes == null ? null : String(p.soloMinutes),
        p.clearArea ?? null,
        p.level ?? null,
        p.morningMinutes ?? null,
        p.hasTools ?? null,
        p.registeredByFamilyId ?? null,
      ],
    );
  },
  async countHelpersByTeam() {
    const counts = EMPTY_COUNTS();
    const rows = await query<{ team_id: TeamId; n: string }>(
      "select team_id, count(*)::text as n from participants where role = 'helper' and team_id is not null group by team_id",
    );
    for (const r of rows) counts[r.team_id] = Number(r.n);
    return counts;
  },
  async findBaseByRequester(requesterId) {
    const rows = await query<{ id: string; number: number; requester_id: string }>(
      "select id, number, requester_id from bases where requester_id = $1",
      [requesterId],
    );
    return rows[0] ? { id: rows[0].id, number: Number(rows[0].number), requesterId: rows[0].requester_id } : undefined;
  },
  async nextBaseNumber() {
    const rows = await query<{ n: number }>("select coalesce(max(number), 0) + 1 as n from bases");
    return Number(rows[0]?.n ?? 1);
  },
  async upsertBase(b) {
    await query(
      `insert into bases (id, number, requester_id) values ($1, $2, $3)
       on conflict (id) do update set number = excluded.number, requester_id = excluded.requester_id`,
      [b.id, b.number, b.requesterId],
    );
  },
  async addFamilyLink(link) {
    await query(
      `insert into family_links (family_line_user_id, requester_id, link_code) values ($1, $2, $3)
       on conflict (family_line_user_id, requester_id) do update set link_code = excluded.link_code`,
      [link.familyLineUserId, link.requesterId, link.linkCode],
    );
  },
  async findFamilyLinkByCode(code) {
    const rows = await query<{ family_line_user_id: string; requester_id: string; link_code: string }>(
      "select family_line_user_id, requester_id, link_code from family_links where link_code = $1",
      [code],
    );
    return rows[0]
      ? { familyLineUserId: rows[0].family_line_user_id, requesterId: rows[0].requester_id, linkCode: rows[0].link_code }
      : undefined;
  },
  async getSession(lineUserId) {
    const rows = await query<{ session: RegSession }>("select session from line_sessions where line_user_id = $1", [lineUserId]);
    return rows[0]?.session;
  },
  async setSession(lineUserId, session) {
    if (!session) {
      await query("delete from line_sessions where line_user_id = $1", [lineUserId]);
      return;
    }
    await query(
      `insert into line_sessions (line_user_id, session, updated_at) values ($1, $2::jsonb, now())
       on conflict (line_user_id) do update set session = excluded.session, updated_at = now()`,
      [lineUserId, JSON.stringify(session)],
    );
  },
};

export function repo(): Repo {
  return hasDb() ? dbRepo : memoryRepo;
}
