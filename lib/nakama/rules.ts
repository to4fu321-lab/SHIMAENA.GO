// なかま機能の規則（spec v1.13: ゆるく合流・雪かきバトン・再会）。保存や LINE に関係ない純粋な関数だけ。
// 大事なこと: 自由参加（ひとりで・いつでも）はそのまま。交流は「したい人だけ」で、相手選び・同意・公開範囲はプログラムが決める（AI に任せない）。
import { distanceM } from "../game/help";
import { TOWN } from "../town";
import type { LatLng } from "../types";

// ---- 交流の希望 ----

/** 今日のスタイル（参加するときに選ぶ）。solo = ひとりで自由に */
export type TodayMode = "solo" | "together" | "reunion" | "new";
/** 次は？（活動を終えたときに選ぶ）。none = 特に希望しない */
export type NextWish = "reunion" | "new" | "solo" | "none";

/** 子どもは保護者と一緒なら合流してよい（11/5 本人の答え）。年齢は集めないので、誘い・成立の画面と LINE に必ず添える */
export const CHILD_NOTE = "お子さんは保護者と一緒に参加してください。";

export const TODAY_MODES: { id: TodayMode; label: string; sub: string }[] = [
  { id: "solo", label: "ひとりで自由に", sub: "いつもどおり" },
  { id: "together", label: "誰かと一緒に", sub: "近くの人と10分" },
  { id: "reunion", label: "前回の仲間と", sub: "また会えたら" },
  { id: "new", label: "新しい人と", sub: "はじめましても" },
];

export const NEXT_WISHES: { id: NextWish; label: string }[] = [
  { id: "reunion", label: "また一緒に活動したい" },
  { id: "new", label: "新しい人と活動したい" },
  { id: "solo", label: "次もひとりで" },
  { id: "none", label: "特に希望しない" },
];

export function isTodayMode(v: string): v is TodayMode {
  return TODAY_MODES.some((m) => m.id === v);
}
export function isNextWish(v: string): v is NextWish {
  return NEXT_WISHES.some((m) => m.id === v);
}

export interface NakamaPref {
  participantId: string;
  nextWish?: NextWish;
  todayMode?: TodayMode;
  todayDate?: string; // YYYY-MM-DD
  todayAt?: string; // ISO（選んだ時刻）
}

/** 今日のスタイルが「いま有効」とみなす時間（選んでから3時間） */
export const PRESENCE_HOURS = 3;

/** 今日、交流してよい状態か（ひとりで・選んでいない・古い は出さない） */
export function activeMode(pref: NakamaPref | undefined, today: string, now: Date): Exclude<TodayMode, "solo"> | undefined {
  if (!pref?.todayMode || pref.todayMode === "solo" || pref.todayDate !== today || !pref.todayAt) return undefined;
  const t = Date.parse(pref.todayAt);
  if (!Number.isFinite(t) || now.getTime() - t > PRESENCE_HOURS * 3600_000 || t - now.getTime() > 60_000) return undefined;
  return pref.todayMode;
}

/** 次は？から、今日のスタイルの「おすすめの最初の選択」を決める（押すまでは何も始まらない） */
export function suggestedMode(nextWish: NextWish | undefined): TodayMode {
  if (nextWish === "reunion") return "reunion";
  if (nextWish === "new") return "new";
  return "solo";
}

// ---- 合流の候補 ----

/** 候補の種類: 再会（前回の仲間）／歓迎（初参加の人を迎える）／先輩（初参加の人へ経験者）／新しい人／近く */
export type MeetKind = "reunion" | "welcome" | "senior" | "new" | "nearby";

export const MEET_LABEL: Record<MeetKind, string> = {
  reunion: "前回の仲間",
  welcome: "初参加の人",
  senior: "雪かきの経験者",
  new: "はじめて会う近くの人",
  nearby: "近くの人",
};

/** 候補にする家どうしの距離（m）。距離そのものは画面に出さない */
export const MEET_RADIUS_M = 600;
/** 1回に見せる候補の数 */
export const MAX_CANDIDATES = 3;
/** 同じ人ばかりにならないように: 14日でこの回数以上会った相手は「一緒に」「新しい人と」では後ろへ */
export const OFTEN_MEETS = 2;

export interface Person {
  id: string;
  home: LatLng;
  role: "requester" | "helper";
  /** 初参加（カードも現地の活動もまだない） */
  newcomer: boolean;
  /** LINE で連絡できるか */
  reachable: boolean;
}

export interface CandidateInput {
  me: Person;
  myMode: Exclude<TodayMode, "solo">;
  /** いま交流してよい人とそのスタイル（activeMode で絞ったあと） */
  others: { person: Person; mode: Exclude<TodayMode, "solo"> }[];
  /** 前回の仲間（カードや成立した合流で一緒だった人） */
  companions: Set<string>;
  /** 相手ごとの、14日で会った回数 */
  meets: Map<string, number>;
  /** 出さない相手（今日見送られた・7日で2回見送られた・提案中） */
  excluded: Set<string>;
  /** おたがいに「また一緒に」と手をふった仲間（なかま帳、spec v1.32）。再会の候補で先に */
  mutualWaves?: Set<string>;
}

export interface Candidate {
  participantId: string;
  kind: MeetKind;
  /** 画面に出す説明（呼び名は前回の仲間だけ、ops で足す） */
  label: string;
  score: number;
}

/** 二人のスタイルが合うか（両方が「したい」と言っている組だけ）。相手がひとりを選んでいたら、そもそも others に入らない */
export function modesMatch(mine: Exclude<TodayMode, "solo">, theirs: Exclude<TodayMode, "solo">, companion: boolean): boolean {
  const ok = (m: Exclude<TodayMode, "solo">) => (m === "together" ? true : m === "reunion" ? companion : !companion);
  return ok(mine) && ok(theirs);
}

/**
 * 合流の候補を選ぶ（プログラムが決める）。
 * - 相手も今日「一緒に」系を選んでいる人だけ。家どうし 600m 以内。出さない相手は除く
 * - 初参加の人と経験者を先に（歓迎）。役割（お願いする側・手伝う側）がちがう組を少し先に（年齢では決めない）
 * - 「前回の仲間と」は会った回数が少ない仲間から。「一緒に」「新しい人と」はよく会う相手を後ろへ
 */
export function pickCandidates(input: CandidateInput): Candidate[] {
  const { me, myMode } = input;
  const out: Candidate[] = [];
  for (const { person: o, mode } of input.others) {
    if (o.id === me.id || input.excluded.has(o.id)) continue;
    if (distanceM(me.home, o.home) > MEET_RADIUS_M) continue;
    const companion = input.companions.has(o.id);
    if (!modesMatch(myMode, mode, companion)) continue;
    const met = input.meets.get(o.id) ?? 0;
    let kind: MeetKind;
    if (companion) kind = "reunion";
    else if (o.newcomer && !me.newcomer) kind = "welcome";
    else if (me.newcomer && !o.newcomer) kind = "senior";
    else kind = myMode === "new" ? "new" : "nearby";
    let score = 0;
    if (kind === "welcome" || kind === "senior") score += 30; // 初参加の人が孤立しないように
    if (kind === "reunion" && myMode === "reunion") score += 25;
    if (kind === "reunion" && input.mutualWaves?.has(o.id)) score += 15; // おたがいに「また一緒に」
    if (o.role !== me.role) score += 5; // ちがう立場の人どうし（世代は年齢で決めつけない）
    if (myMode === "reunion") score -= met * 3; // 仲間の中でも、会った回数が少ない人から
    else if (met >= OFTEN_MEETS) score -= 20; // 同じ人ばかりにしない
    score -= distanceM(me.home, o.home) / 100; // 近いほど少し先
    out.push({ participantId: o.id, kind, label: MEET_LABEL[kind], score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, MAX_CANDIDATES);
}

/** 同じ仲間とよく会っている人への、新しい人もどうぞの一言（プログラムが出すかを決める） */
export function oftenNudge(myMode: TodayMode, candidates: Candidate[], meets: Map<string, number>): string | undefined {
  if (myMode !== "reunion") return undefined;
  const often = candidates.some((c) => (meets.get(c.participantId) ?? 0) >= OFTEN_MEETS + 1);
  return often ? "いつもの仲間に加えて、たまには新しい人とも組んでみませんか？" : undefined;
}

// ---- 合流の提案と同意 ----

export type MeetWindow = "now10" | "today";
export type MeetStatus = "proposed" | "accepted" | "declined" | "expired";

export const WINDOW_LABEL: Record<MeetWindow, string> = { now10: "今から10分以内", today: "今日の都合のよい時間" };

export interface Meetup {
  id: string;
  date: string;
  fromId: string;
  toId: string;
  kind: MeetKind;
  window: MeetWindow;
  /** 場所: 地図の家の番号（その家の行き先は「10分だけ参加」で本人にだけ届く）。なければそれぞれの家の前 */
  baseNumber?: number;
  missionId?: string;
  status: MeetStatus;
  /** 誘いの一文（AI、点検済み。キーなしは決まった文） */
  message: string;
  createdAt: string;
  respondedAt?: string;
}

/** 1人が1日に送れる・受け取れる誘いの数 */
export const DAILY_PROPOSALS = 3;
export const DAILY_INCOMING = 3;

/** 返事の期限（ISO）。今から10分以内は30分、今日のどこかは19時（夜の防犯ルール） */
export function deadlineOf(m: Pick<Meetup, "window" | "createdAt" | "date">): string {
  if (m.window === "now10") return new Date(Date.parse(m.createdAt) + 30 * 60_000).toISOString();
  return `${m.date}T10:00:00.000Z`; // 19:00 JST
}

/** いまの状態（期限を過ぎた提案は期限切れ） */
export function statusNow(m: Meetup, now: Date): MeetStatus {
  if (m.status === "proposed" && now.toISOString() > deadlineOf(m)) return "expired";
  return m.status;
}

export type RespondResult = { ok: true; meetup: Meetup } | { ok: false; reason: "not_yours" | "closed" | "expired" };

/**
 * 誘いに答える。答えられるのは誘われた本人だけ。両方の同意（誘った＝同意、誘われた人の「一緒にやる」）がそろったときだけ成立。
 * 見送りの理由は相手に伝えない。
 */
export function respond(m: Meetup, responderId: string, accept: boolean, now: Date): RespondResult {
  if (m.toId !== responderId) return { ok: false, reason: "not_yours" };
  const st = statusNow(m, now);
  if (st === "expired") return { ok: false, reason: "expired" };
  if (st !== "proposed") return { ok: false, reason: "closed" };
  return { ok: true, meetup: { ...m, status: accept ? "accepted" : "declined", respondedAt: now.toISOString() } };
}

/** 出さない相手: 今日見送られた・7日で2回見送られた・いま返事を待っている・今日もう成立した */
export function excludedFor(meId: string, meetups: Meetup[], today: string, now: Date, weekAgo: string): Set<string> {
  const out = new Set<string>();
  const declines = new Map<string, number>();
  for (const m of meetups) {
    if (m.fromId !== meId && m.toId !== meId) continue;
    const other = m.fromId === meId ? m.toId : m.fromId;
    const st = statusNow(m, now);
    if (m.date === today && (st === "proposed" || st === "accepted")) out.add(other);
    if (m.fromId === meId && st === "declined") {
      if (m.date === today) out.add(other);
      if (m.date >= weekAgo) declines.set(other, (declines.get(other) ?? 0) + 1);
    }
  }
  for (const [id, n] of declines) if (n >= 2) out.add(id);
  return out;
}

/** 14日で、成立した合流で会った回数 */
export function meetCounts(meId: string, meetups: Meetup[], since: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of meetups) {
    if (m.status !== "accepted" || m.date < since) continue;
    if (m.fromId === meId) out.set(m.toId, (out.get(m.toId) ?? 0) + 1);
    else if (m.toId === meId) out.set(m.fromId, (out.get(m.fromId) ?? 0) + 1);
  }
  return out;
}

/** 誘いの決まった文（キーがないとき・AI の文が点検に通らないとき） */
export function templateInvite(kind: MeetKind, window: MeetWindow, place?: number): string {
  const when = window === "now10" ? "今から10分だけ" : "今日のどこかで10分だけ";
  const where = place ? `地図の${place}番の家で、` : "";
  if (kind === "reunion") return `前回一緒に活動した仲間が、今日も参加しています。${where}${when}一緒にどうですか？`;
  if (kind === "welcome") return `近くの人が、${where}${when}一緒に雪かきしませんか、と言っています。`;
  if (kind === "senior") return `はじめての人が近くにいます。${where}${when}一緒にどうですか？`;
  return `近くで活動中の参加者がいます。${where}${when}一緒に雪かきしてみませんか？`;
}

// ---- 雪かきバトン ----

/** 地域の大きさ（m）。50m マスより粗くして、どの家かは分からないようにする */
export const AREA_M = 250;
const M_PER_LAT = 111320;
const M_PER_LNG = 111320 * Math.cos((TOWN.center[0] * Math.PI) / 180);

export function areaKey(p: LatLng): string {
  const row = Math.floor(((p[0] - TOWN.center[0]) * M_PER_LAT) / AREA_M);
  const col = Math.floor(((p[1] - TOWN.center[1]) * M_PER_LNG) / AREA_M);
  return `a${row},${col}`;
}

/** 50m マスのキー（"row,col"）から、そのマスの地域 */
export function areaOfCell(cell: string): string {
  const [row, col] = cell.split(",").map(Number);
  return areaKey([TOWN.center[0] + (row * 50) / M_PER_LAT, TOWN.center[1] + (col * 50) / M_PER_LNG]);
}

export type BatonSource = "own_house" | "help_house" | "road";
export type BatonStatus = "done" | "partial";
export type BatonReaction = "thanks" | "continue";

export const BATON_PRESETS = ["ここまで雪かきしました", "砂まきが残っています", "続きをお願いします"] as const;
export const BATON_TEXT_MAX = 30;
export const REACTION_LABEL: Record<BatonReaction, string> = { thanks: "前の人ありがとう", continue: "続きをやります" };

export interface Baton {
  id: string;
  participantId: string; // 画面には出さない
  date: string;
  area: string;
  source: BatonSource;
  status: BatonStatus;
  message: string;
  photoChecked: boolean;
  /** つながりの一文（AI、点検済み） */
  story?: string;
  at: string;
}

export const SOURCE_LABEL: Record<BatonSource, string> = {
  own_house: "自分の家の前",
  help_house: "お手伝いの家",
  road: "道",
};

/**
 * バトンのひとことの点検。名前・番号・場所の言い方は使わない（だめなら undefined）。
 * 「さん」「様」「丁目」「番地」、3けた以上の数字、電話や URL らしいもの。
 */
export function cleanBatonText(s: string): string | undefined {
  const t = s.replace(/\s+/g, " ").trim();
  if (!t) return undefined;
  if (t.length > BATON_TEXT_MAX) return undefined;
  if (/[0-9０-９]{3,}|(?<!みな)さん|様|ちゃん|くん|丁目|番地|号室|条|http|@|＠/.test(t)) return undefined;
  return t;
}

/** 時間帯の言い方（バトンの一覧に出す） */
export function timeBand(iso: string): string {
  const h = Number(new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(11, 13));
  if (h < 10) return "朝";
  if (h < 14) return "お昼";
  return "午後";
}

/** つながりの決まった文 */
export function templateStory(prev: Pick<Baton, "at" | "status">[], now: string, people: number): string {
  const head = prev.length > 0 ? `${timeBand(prev[0].at)}の活動者がここまで雪かきをしました。` : "この地域の最初のバトンです。";
  const mid = prev.length > 0 ? `${timeBand(now)}のあなたがバトンを受け取りました。` : "";
  return `${head}${mid}この地域の雪かきに、今日${people}人が参加しました。`;
}

// ---- AI の文の点検（合流・バトンで共通） ----

/** 恋愛や気持ちを推し量る言葉・人を急かす言葉は使わない（友情・地域活動・共助だけ） */
const BANNED = /恋|デート|好き|付き合|運命|相性|ときめ|寂し|さみし|孤独|かわいそう|必ず来|絶対|急いで|義務/;

/**
 * AI が書いた文を使ってよいか。長さ・禁止の言葉・名前や場所の言い方・入力にない数字。
 * allowedNumbers にない数字が出たら使わない（数字を作らせない）。
 */
export function aiLineOk(s: string, max: number, allowedNumbers: number[]): boolean {
  const t = s.trim();
  if (!t || t.length > max) return false;
  if (BANNED.test(t)) return false;
  if (/(?<!みな)さん|様|丁目|番地|http/.test(t)) return false;
  const nums = (t.match(/[0-9０-９]+/g) ?? []).map((n) => Number(n.replace(/[０-９]/g, (c) => String(c.charCodeAt(0) - 0xff10))));
  return nums.every((n) => allowedNumbers.includes(n));
}
