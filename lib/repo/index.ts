// 参加者・拠点・家族の紐づけ・LINE の登録途中経過の保存先。
// DATABASE_URL があれば Neon、なければメモリ（開発用）。素の SQL だけ。
import { hasDb, query } from "../db";
import { demoParticipantId } from "../inbox/key";
import type { RegSession } from "../line/registration";
import { TOWN } from "../town";
import type { Base, Card, FamilyLink, Participant, SoloLog, TeamId } from "../types";

export interface Repo {
  findParticipantByLineUserId(lineUserId: string): Promise<Participant | undefined>;
  findParticipant(id: string): Promise<Participant | undefined>;
  listParticipants(): Promise<Participant[]>;
  upsertParticipant(p: Participant): Promise<void>;
  countHelpersByTeam(): Promise<Record<TeamId, number>>;
  findBaseByRequester(requesterId: string): Promise<Base | undefined>;
  listBases(): Promise<Base[]>;
  nextBaseNumber(): Promise<number>;
  upsertBase(b: Base): Promise<void>;
  addFamilyLink(link: FamilyLink): Promise<void>;
  findFamilyLinkByCode(code: string): Promise<FamilyLink | undefined>;
  listFamilyLinksByRequester(requesterId: string): Promise<FamilyLink[]>;
  /** その家族（LINE のアカウント ID）が受け取る家の紐づけ */
  listFamilyLinksByFamily(familyLineUserId: string): Promise<FamilyLink[]>;
  getSession(lineUserId: string): Promise<RegSession | undefined>;
  setSession(lineUserId: string, session: RegSession | null): Promise<void>;
  // カード（表面・裏面の SVG を持つ）
  insertCard(card: Card, svg: string, backSvg: string): Promise<void>;
  getCard(id: string): Promise<{ card: Card; svg: string; backSvg: string } | undefined>;
  listCardsByRecipient(recipientId: string): Promise<Card[]>;
  countCardsForRollcall(rollcallId: string): Promise<number>;
  listCardsByMission(missionId: string): Promise<Card[]>;
  /** 裏面を作り直す（ありがとう点呼が届いたとき） */
  updateCardBack(id: string, backSvg: string): Promise<void>;
  /** 発行したカードの総数（公開ページの集計） */
  countCards(): Promise<number>;
  // ソロ出動の台帳（v1.3）。同じ人・同じ日・同じ種類（家の完了は missionId ごと）は1回だけ。入れば true
  insertSoloLog(log: SoloLog): Promise<boolean>;
  listSoloLogsByParticipant(participantId: string): Promise<SoloLog[]>;
  /** from 〜 to（両端を含む、YYYY-MM-DD）の全員の台帳 */
  listSoloLogsBetween(from: string, to: string): Promise<SoloLog[]>;
  // 町を応援する（SNS 閲覧者、日付ごとの件数）
  getCheer(date: string): Promise<number>;
  incrementCheer(date: string): Promise<number>;
}

// ---- メモリ ----
interface Mem {
  participants: Map<string, Participant>;
  bases: Map<string, Base>;
  links: FamilyLink[];
  sessions: Map<string, RegSession>;
  cards: Map<string, { card: Card; svg: string; backSvg: string }>;
  soloLogs: Map<string, SoloLog>;
  cheers: Map<string, number>;
}
const g = globalThis as { __shimaenaRepo?: Mem };
function mem(): Mem {
  g.__shimaenaRepo ??= {
    participants: new Map(TOWN.participants.map((p) => [p.id, structuredClone(p)])),
    bases: new Map(TOWN.bases.map((b) => [b.id, structuredClone(b)])),
    links: [],
    sessions: new Map(),
    cards: new Map(),
    soloLogs: new Map(),
    cheers: new Map(),
  };
  return g.__shimaenaRepo;
}

const EMPTY_COUNTS = (): Record<TeamId, number> => ({ salvia: 0, marigold: 0, lupinus: 0 });

export const memoryRepo: Repo = {
  async findParticipantByLineUserId(lineUserId) {
    const demo = demoParticipantId(lineUserId);
    if (demo) return mem().participants.get(demo);
    return [...mem().participants.values()].find((p) => p.lineUserId === lineUserId);
  },
  async findParticipant(id) {
    return mem().participants.get(id);
  },
  async listParticipants() {
    return [...mem().participants.values()].map((p) => structuredClone(p));
  },
  async upsertParticipant(p) {
    mem().participants.set(p.id, structuredClone(p));
  },
  async countHelpersByTeam() {
    const counts = EMPTY_COUNTS();
    for (const p of mem().participants.values()) if (p.teamId) counts[p.teamId]++; // お願いする側もチームに入る（v1.10）
    return counts;
  },
  async findBaseByRequester(requesterId) {
    return [...mem().bases.values()].find((b) => b.requesterId === requesterId);
  },
  async listBases() {
    return [...mem().bases.values()].sort((a, b) => a.number - b.number).map((b) => structuredClone(b));
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
  async listFamilyLinksByRequester(requesterId) {
    return mem().links.filter((l) => l.requesterId === requesterId);
  },
  async listFamilyLinksByFamily(familyLineUserId) {
    return mem().links.filter((l) => l.familyLineUserId === familyLineUserId);
  },
  async getSession(lineUserId) {
    return mem().sessions.get(lineUserId);
  },
  async setSession(lineUserId, session) {
    if (session) mem().sessions.set(lineUserId, session);
    else mem().sessions.delete(lineUserId);
  },
  async insertCard(card, svg, backSvg) {
    mem().cards.set(card.id, { card: structuredClone(card), svg, backSvg });
  },
  async getCard(id) {
    return mem().cards.get(id);
  },
  async listCardsByRecipient(recipientId) {
    return [...mem().cards.values()]
      .map((c) => c.card)
      .filter((c) => c.recipientId === recipientId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  },
  async countCardsForRollcall(rollcallId) {
    return [...mem().cards.values()].filter((c) => c.card.rollcallId === rollcallId).length;
  },
  async listCardsByMission(missionId) {
    return [...mem().cards.values()].map((c) => c.card).filter((c) => c.missionId === missionId);
  },
  async updateCardBack(id, backSvg) {
    const c = mem().cards.get(id);
    if (c) c.backSvg = backSvg;
  },
  async countCards() {
    return mem().cards.size;
  },
  async insertSoloLog(log) {
    const dup = [...mem().soloLogs.values()].some(
      (l) => l.participantId === log.participantId && l.date === log.date && l.kind === log.kind && (l.missionId ?? "") === (log.missionId ?? ""),
    );
    if (dup || mem().soloLogs.has(log.id)) return false;
    mem().soloLogs.set(log.id, structuredClone(log));
    return true;
  },
  async listSoloLogsByParticipant(participantId) {
    return [...mem().soloLogs.values()]
      .filter((l) => l.participantId === participantId)
      .sort((a, b) => (a.at < b.at ? -1 : 1))
      .map((l) => structuredClone(l));
  },
  async listSoloLogsBetween(from, to) {
    return [...mem().soloLogs.values()]
      .filter((l) => l.date >= from && l.date <= to)
      .sort((a, b) => (a.at < b.at ? -1 : 1))
      .map((l) => structuredClone(l));
  },
  async getCheer(date) {
    return mem().cheers.get(date) ?? 0;
  },
  async incrementCheer(date) {
    const n = (mem().cheers.get(date) ?? 0) + 1;
    mem().cheers.set(date, n);
    return n;
  },
};

// ---- ソロ台帳（Neon） ----
interface SoloLogRow {
  id: string;
  participant_id: string;
  date: string;
  kind: SoloLog["kind"];
  onsite: boolean;
  feathers: number;
  note: string | null;
  hitokoto: string | null;
  photo_checked: boolean | null;
  cell_key: string | null;
  mission_id: string | null;
  at: string;
}
const SOLO_COLS = "id, participant_id, date, kind, onsite, feathers, note, hitokoto, photo_checked, cell_key, mission_id, at";
function rowToSoloLog(r: SoloLogRow): SoloLog {
  const l: SoloLog = {
    id: r.id,
    participantId: r.participant_id,
    date: r.date,
    kind: r.kind,
    onsite: r.onsite,
    feathers: Number(r.feathers),
    at: new Date(r.at).toISOString(),
  };
  if (r.note) l.note = r.note;
  if (r.hitokoto) l.hitokoto = r.hitokoto;
  if (r.photo_checked != null) l.photoChecked = r.photo_checked;
  if (r.cell_key) l.cellKey = r.cell_key;
  if (r.mission_id) l.missionId = r.mission_id;
  return l;
}

const dbSoloMethods: Pick<Repo, "countCards" | "insertSoloLog" | "listSoloLogsByParticipant" | "listSoloLogsBetween" | "getCheer" | "incrementCheer"> = {
  async countCards() {
    const rows = await query<{ n: string }>("select count(*)::text as n from cards");
    return Number(rows[0]?.n ?? 0);
  },
  async insertSoloLog(log) {
    // 一意 index（solo_logs_once）に当たれば入らない → false
    const rows = await query<{ id: string }>(
      `insert into solo_logs (id, participant_id, date, kind, onsite, feathers, note, hitokoto, photo_checked, cell_key, mission_id, at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       on conflict do nothing returning id`,
      [
        log.id, log.participantId, log.date, log.kind, log.onsite, log.feathers, log.note ?? null, log.hitokoto ?? null,
        log.photoChecked ?? null, log.cellKey ?? null, log.missionId ?? null, log.at,
      ],
    );
    return rows.length > 0;
  },
  async listSoloLogsByParticipant(participantId) {
    const rows = await query<SoloLogRow>(`select ${SOLO_COLS} from solo_logs where participant_id = $1 order by at`, [participantId]);
    return rows.map(rowToSoloLog);
  },
  async listSoloLogsBetween(from, to) {
    const rows = await query<SoloLogRow>(`select ${SOLO_COLS} from solo_logs where date >= $1 and date <= $2 order by at`, [from, to]);
    return rows.map(rowToSoloLog);
  },
  async getCheer(date) {
    const rows = await query<{ count: number }>("select count from town_cheers where date = $1", [date]);
    return Number(rows[0]?.count ?? 0);
  },
  async incrementCheer(date) {
    const rows = await query<{ count: number }>(
      `insert into town_cheers (date, count) values ($1, 1)
       on conflict (date) do update set count = town_cheers.count + 1 returning count`,
      [date],
    );
    return Number(rows[0]?.count ?? 0);
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

interface CardRow {
  id: string;
  recipient_id: string;
  rollcall_id: string;
  mission_id: string;
  serial: number;
  issued_count: number;
  design_name: string;
  design_name_en: string;
  rarity_label: string;
  stars: number;
  style: Card["style"];
  snow_kg: number;
  snow_kg_comparison: string;
  member_names: string[];
  team_ids: TeamId[];
  created_at: string;
}
const CARD_COLS =
  "id, recipient_id, rollcall_id, mission_id, serial, issued_count, design_name, design_name_en, rarity_label, stars, style, snow_kg, snow_kg_comparison, member_names, team_ids, created_at";
function rowToCard(r: CardRow): Card {
  return {
    id: r.id,
    recipientId: r.recipient_id,
    rollcallId: r.rollcall_id,
    missionId: r.mission_id,
    serial: Number(r.serial),
    issuedCount: Number(r.issued_count),
    designName: r.design_name,
    designNameEn: r.design_name_en,
    rarityLabel: r.rarity_label,
    stars: Number(r.stars) as 1 | 2 | 3,
    style: r.style,
    snowKg: Number(r.snow_kg),
    snowKgComparison: r.snow_kg_comparison,
    memberNames: r.member_names,
    teamIds: r.team_ids,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

const dbCardMethods: Pick<
  Repo,
  "insertCard" | "getCard" | "listCardsByRecipient" | "countCardsForRollcall" | "listCardsByMission" | "updateCardBack"
> = {
  async listCardsByMission(missionId) {
    const rows = await query<CardRow>(`select ${CARD_COLS} from cards where mission_id = $1 order by serial`, [missionId]);
    return rows.map(rowToCard);
  },
  async updateCardBack(id, backSvg) {
    await query("update cards set back_svg = $2 where id = $1", [id, backSvg]);
  },
  async insertCard(card, svg, backSvg) {
  await query(
    `insert into cards (id, recipient_id, rollcall_id, mission_id, serial, issued_count, design_name, design_name_en, rarity_label, stars, style,
       snow_kg, snow_kg_comparison, member_names, team_ids, svg, back_svg, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15::jsonb, $16, $17, $18)
     on conflict (id) do nothing`,
    [
      card.id, card.recipientId, card.rollcallId, card.missionId, card.serial, card.issuedCount, card.designName, card.designNameEn,
      card.rarityLabel, card.stars, card.style, card.snowKg, card.snowKgComparison, JSON.stringify(card.memberNames),
      JSON.stringify(card.teamIds), svg, backSvg, card.createdAt,
    ],
  );
  },
  async getCard(id) {
  const rows = await query<CardRow & { svg: string; back_svg: string }>(`select ${CARD_COLS}, svg, back_svg from cards where id = $1`, [id]);
  return rows[0] ? { card: rowToCard(rows[0]), svg: rows[0].svg, backSvg: rows[0].back_svg } : undefined;
  },
  async listCardsByRecipient(recipientId) {
  const rows = await query<CardRow>(`select ${CARD_COLS} from cards where recipient_id = $1 order by created_at desc`, [recipientId]);
  return rows.map(rowToCard);
  },
  async countCardsForRollcall(rollcallId) {
  const rows = await query<{ n: string }>("select count(*)::text as n from cards where rollcall_id = $1", [rollcallId]);
  return Number(rows[0]?.n ?? 0);
  },
};

export const dbRepo: Repo = {
  ...dbCardMethods,
  ...dbSoloMethods,
  async findParticipantByLineUserId(lineUserId) {
    const demo = demoParticipantId(lineUserId);
    if (demo) return dbRepo.findParticipant(demo);
    const rows = await query<ParticipantRow>(`select ${PARTICIPANT_COLS} from participants where line_user_id = $1`, [lineUserId]);
    return rows[0] ? rowToParticipant(rows[0]) : undefined;
  },
  async findParticipant(id) {
    const rows = await query<ParticipantRow>(`select ${PARTICIPANT_COLS} from participants where id = $1`, [id]);
    return rows[0] ? rowToParticipant(rows[0]) : undefined;
  },
  async listParticipants() {
    const rows = await query<ParticipantRow>(`select ${PARTICIPANT_COLS} from participants order by created_at, id`);
    return rows.map(rowToParticipant);
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
      "select team_id, count(*)::text as n from participants where team_id is not null group by team_id",
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
  async listBases() {
    const rows = await query<{ id: string; number: number; requester_id: string }>("select id, number, requester_id from bases order by number");
    return rows.map((r) => ({ id: r.id, number: Number(r.number), requesterId: r.requester_id }));
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
  async listFamilyLinksByRequester(requesterId) {
    const rows = await query<{ family_line_user_id: string; requester_id: string; link_code: string }>(
      "select family_line_user_id, requester_id, link_code from family_links where requester_id = $1",
      [requesterId],
    );
    return rows.map((r) => ({ familyLineUserId: r.family_line_user_id, requesterId: r.requester_id, linkCode: r.link_code }));
  },
  async listFamilyLinksByFamily(familyLineUserId) {
    const rows = await query<{ family_line_user_id: string; requester_id: string; link_code: string }>(
      "select family_line_user_id, requester_id, link_code from family_links where family_line_user_id = $1",
      [familyLineUserId],
    );
    return rows.map((r) => ({ familyLineUserId: r.family_line_user_id, requesterId: r.requester_id, linkCode: r.link_code }));
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
