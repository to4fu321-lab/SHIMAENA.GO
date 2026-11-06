// なかま機能の本番の操作（spec v1.13）。画面（/nakama・完了画面）と LINE から呼ぶ。
// 相手選び・同意・公開範囲・夜とお休みの日の制限はここ（プログラム）で決める。AI は文を書くだけ（lib/claude/nakama.ts）。
import { randomBytes } from "node:crypto";
import { batonStoryLine, meetupInviteLine } from "../claude/nakama";
import { distanceM } from "../game/help";
import { addDays } from "../jst";
import { inboxKeyOf } from "../inbox/key";
import { push } from "../line/client";
import { MSG } from "../line/messages";
import { loadMorning } from "../morning/store";
import { loadRoster, type Roster } from "../morning/roster";
import { appToday } from "../morning/today";
import { isNight, nightRefusal } from "../night";
import { repo } from "../repo";
import { stormStopText } from "../storm";
import type { Participant } from "../types";
import {
  activeMode,
  areaKey,
  areaOfCell,
  BATON_PRESETS,
  cleanBatonText,
  DAILY_INCOMING,
  DAILY_PROPOSALS,
  excludedFor,
  isNextWish,
  isTodayMode,
  MEET_LABEL,
  MEET_RADIUS_M,
  meetCounts,
  oftenNudge,
  pickCandidates,
  respond,
  SOURCE_LABEL,
  statusNow,
  suggestedMode,
  timeBand,
  WINDOW_LABEL,
  type Baton,
  type BatonReaction,
  type BatonSource,
  type MeetKind,
  type Meetup,
  type MeetWindow,
  type NextWish,
  type Person,
  type TodayMode,
} from "./rules";
import {
  countIncoming,
  getBaton,
  getMeetup,
  getPref,
  insertBaton,
  insertMeetup,
  listBatons,
  listBatonsBy,
  listMeetupsFor,
  listPrefsOn,
  reactionsOf,
  setNextWishRow,
  setReaction,
  setTodayModeRow,
  updateMeetupStatus,
} from "./store";

const newId = (p: string) => `${p}-${randomBytes(6).toString("base64url")}`;

async function todayOf(now: Date): Promise<string> {
  return appToday(await loadMorning(), now);
}

/** 初参加か（カードも、現地の活動の記録もまだない） */
async function isNewcomer(id: string): Promise<boolean> {
  const r = repo();
  const [cards, logs] = await Promise.all([r.listCardsByRecipient(id).catch(() => []), r.listSoloLogsByParticipant(id).catch(() => [])]);
  return cards.length === 0 && !logs.some((l) => l.onsite && !l.kind.startsWith("bonus_"));
}

/** 前回の仲間: 同じ家・同じ時のカードを一緒に受け取った人と、成立した合流の相手 */
export async function companionsOf(id: string, meetups: Meetup[]): Promise<Set<string>> {
  const r = repo();
  const out = new Set<string>();
  try {
    const mine = await r.listCardsByRecipient(id);
    const missionIds = [...new Set(mine.map((c) => c.missionId))].slice(-20);
    for (const mid of missionIds) for (const c of await r.listCardsByMission(mid)) if (c.recipientId !== id) out.add(c.recipientId);
  } catch (e) {
    console.error("[nakama] カードから仲間を読めませんでした:", e instanceof Error ? e.message : e);
  }
  for (const m of meetups) if (m.status === "accepted") out.add(m.fromId === id ? m.toId : m.fromId);
  return out;
}

const toPerson = (p: Participant, newcomer: boolean): Person => ({
  id: p.id,
  home: p.location,
  role: p.role,
  newcomer,
  reachable: Boolean(inboxKeyOf(p)),
});

/** 合流の場所: 2人の家の近くで、いま人を待っている家（地図の番号だけ。行き先は「10分だけ参加」で本人にだけ届く） */
function meetingPlace(a: Participant, b: Participant, roster: Roster, record: Awaited<ReturnType<typeof loadMorning>>): { missionId: string; baseNumber: number } | undefined {
  if (record.morning.rollcall.status !== "planned") return undefined;
  const mid: [number, number] = [(a.location[0] + b.location[0]) / 2, (a.location[1] + b.location[1]) / 2];
  let best: { missionId: string; baseNumber: number; d: number } | undefined;
  for (const m of record.morning.missions) {
    if (m.status === "done" || m.status === "no_answer") continue;
    const base = roster.bases.find((x) => x.id === m.baseId);
    const home = base && roster.participants.find((p) => p.id === base.requesterId);
    if (!base || !home || home.id === a.id || home.id === b.id) continue;
    const d = distanceM(mid, home.location);
    if (d <= MEET_RADIUS_M && (!best || d < best.d)) best = { missionId: m.id, baseNumber: base.number, d };
  }
  return best && { missionId: best.missionId, baseNumber: best.baseNumber };
}

/** よその家に行く話なので、夜とお休みの日は止める（理由の文。止めないときは undefined） */
async function blockedNow(now: Date): Promise<string | undefined> {
  if (isNight(now)) return `${nightRefusal()} 合流は明るい時間にどうぞ。ひとりでの自分の家の雪かきはいつでもできます。`;
  return stormStopText();
}

// ---- 交流の希望 ----

export async function setTodayMode(participantId: string, mode: string, now: Date): Promise<{ ok: boolean; text: string }> {
  if (!isTodayMode(mode)) return { ok: false, text: "その選び方はありません。" };
  const p = await repo().findParticipant(participantId);
  if (!p) return { ok: false, text: "登録が見つかりません。LINE から開いてください。" };
  await setTodayModeRow(p.id, mode, await todayOf(now), now.toISOString());
  return { ok: true, text: mode === "solo" ? "今日はひとりで自由に。いつもどおりどうぞ。" : "近くで同じ気持ちの人をさがします。見つからなくても、いつもどおり参加できます。" };
}

export async function setNextWish(participantId: string, wish: string): Promise<{ ok: boolean; text: string }> {
  if (!isNextWish(wish)) return { ok: false, text: "その選び方はありません。" };
  const p = await repo().findParticipant(participantId);
  if (!p) return { ok: false, text: "登録が見つかりません。" };
  await setNextWishRow(p.id, wish);
  const text: Record<NextWish, string> = {
    reunion: "次に参加したとき、今日の仲間が来ていたらお知らせします。",
    new: "次は新しい仲間との機会をさがします。",
    solo: "次もひとりで自由に。いつでも変えられます。",
    none: "わかりました。いつでも変えられます。",
  };
  return { ok: true, text: text[wish] };
}

// ---- 画面の中身 ----

export interface NakamaView {
  today: string;
  /** 夜・お休みの日で、合流を受け付けないときの理由 */
  blocked?: string;
  mode: TodayMode;
  /** いま「一緒に」系が有効か（選んでから3時間） */
  active: boolean;
  nextWish?: NextWish;
  /** 前回の希望が今日の提案に反映されたときの一言 */
  wishLine?: string;
  candidates: { participantId: string; kind: MeetKind; label: string; name?: string }[];
  nudge?: string;
  incoming: { id: string; fromName: string; message: string; windowLabel: string }[];
  waiting: { id: string; label: string }[];
  matched: { id: string; otherName: string; windowLabel: string; baseNumber?: number; missionId?: string }[];
  /** 今日、返事をもらえなかった誘いの数（理由は出さない） */
  notMatched: number;
  area: AreaView;
  /** 実績: 一緒に活動した仲間の数・成立した合流の数（30日） */
  companions: number;
  meets: number;
  /** 自分のバトンに届いた「ありがとう」（7日） */
  thanksForMe: number;
}

export interface AreaView {
  people: number;
  story?: string;
  batons: { id: string; band: string; where: string; done: boolean; message: string; photoChecked: boolean; thanks: number; cont: number; mine?: BatonReaction; own: boolean }[];
}

export async function nakamaView(participantId: string, now: Date): Promise<NakamaView | undefined> {
  const [record, roster] = await Promise.all([loadMorning(), loadRoster()]);
  const me = roster.participants.find((p) => p.id === participantId);
  if (!me) return undefined;
  const today = appToday(record, now);
  const [pref, history, area] = await Promise.all([getPref(me.id), listMeetupsFor(me.id, addDays(today, -30)), areaView(me, today, me.id)]);
  const blocked = await blockedNow(now);
  const mode = activeMode(pref, today, now);
  const nameOf = (id: string) => roster.participants.find((p) => p.id === id)?.nickname ?? "仲間";
  const companions = await companionsOf(me.id, history);

  let candidates: NakamaView["candidates"] = [];
  let nudge: string | undefined;
  let wishLine: string | undefined;
  if (mode && !blocked) {
    const prefs = await listPrefsOn(today);
    const others: { person: Person; mode: Exclude<TodayMode, "solo"> }[] = [];
    for (const pr of prefs) {
      const m = activeMode(pr, today, now);
      const o = roster.participants.find((p) => p.id === pr.participantId);
      if (!m || !o || o.id === me.id) continue; // 今日のスタイルを自分で選んだ人だけ（＝アプリで返事ができる。LINE があれば LINE でも）
      if (distanceM(me.location, o.location) > MEET_RADIUS_M) continue;
      others.push({ person: toPerson(o, await isNewcomer(o.id)), mode: m });
    }
    const meets = meetCounts(me.id, history, addDays(today, -14));
    const picked = pickCandidates({
      me: toPerson(me, await isNewcomer(me.id)),
      myMode: mode,
      others,
      companions,
      meets,
      excluded: excludedFor(me.id, history, today, now, addDays(today, -7)),
    });
    // 呼び名は「前回の仲間」だけ（もうカードで知っている）。新しい人は成立するまで出さない
    candidates = picked.map((c) => ({ participantId: c.participantId, kind: c.kind, label: c.label, ...(c.kind === "reunion" ? { name: nameOf(c.participantId) } : {}) }));
    nudge = oftenNudge(mode, picked, meets);
    if (pref?.nextWish === "reunion" && picked.some((c) => c.kind === "reunion")) wishLine = "前回「また一緒に」を選びました。前回の仲間が、今日も参加しています。";
    if (pref?.nextWish === "new" && picked.some((c) => c.kind !== "reunion")) wishLine = "前回「新しい人と」を選びました。今日は新しい仲間と活動してみませんか？";
  }

  const todays = history.filter((m) => m.date === today);
  return {
    today,
    blocked,
    mode: mode ?? (pref?.todayDate === today && pref.todayMode === "solo" ? "solo" : suggestedMode(pref?.nextWish)),
    active: Boolean(mode),
    nextWish: pref?.nextWish,
    wishLine,
    candidates,
    nudge,
    incoming: todays
      .filter((m) => m.toId === me.id && statusNow(m, now) === "proposed")
      .map((m) => ({ id: m.id, fromName: nameOf(m.fromId), message: m.message, windowLabel: WINDOW_LABEL[m.window] })),
    waiting: todays
      .filter((m) => m.fromId === me.id && statusNow(m, now) === "proposed")
      .map((m) => ({ id: m.id, label: m.kind === "reunion" ? nameOf(m.toId) : MEET_LABEL[m.kind] })),
    matched: todays
      .filter((m) => m.status === "accepted")
      .map((m) => ({ id: m.id, otherName: nameOf(m.fromId === me.id ? m.toId : m.fromId), windowLabel: WINDOW_LABEL[m.window], baseNumber: m.baseNumber, missionId: m.missionId })),
    notMatched: todays.filter((m) => m.fromId === me.id && ["declined", "expired"].includes(statusNow(m, now))).length,
    area,
    companions: companions.size,
    meets: history.filter((m) => m.status === "accepted").length,
    thanksForMe: await thanksFor(me.id, addDays(today, -6)),
  };
}

// ---- 合流の提案と同意 ----

export type ProposeResult = { ok: true; text: string; sent: boolean } | { ok: false; text: string };

/** 誘う（押した本人の同意）。相手は候補に出ていた人だけ。相手の LINE に1回だけ知らせる */
export async function proposeMeetup(fromId: string, toId: string, window: string, now: Date): Promise<ProposeResult> {
  const win: MeetWindow = window === "today" ? "today" : "now10";
  const blocked = await blockedNow(now);
  if (blocked) return { ok: false, text: blocked };
  const view = await nakamaView(fromId, now);
  if (!view) return { ok: false, text: "登録が見つかりません。LINE から開いてください。" };
  if (!view.active) return { ok: false, text: "先に「誰かと一緒に」などを選んでください。" };
  const cand = view.candidates.find((c) => c.participantId === toId);
  if (!cand) return { ok: false, text: "いまはその人を誘えません。ほかの候補か、ひとりでどうぞ。" };
  const today = view.today;
  const mine = (await listMeetupsFor(fromId, today)).filter((m) => m.fromId === fromId && m.date === today);
  if (mine.length >= DAILY_PROPOSALS) return { ok: false, text: `誘えるのは1日${DAILY_PROPOSALS}回までです。今日はひとりで自由にどうぞ。` };
  if ((await countIncoming(toId, today)) >= DAILY_INCOMING) return { ok: false, text: "その人は今日はたくさん誘われています。ほかの候補か、ひとりでどうぞ。" };

  const [record, roster] = await Promise.all([loadMorning(), loadRoster()]);
  const a = roster.participants.find((p) => p.id === fromId);
  const b = roster.participants.find((p) => p.id === toId);
  if (!a || !b) return { ok: false, text: "相手が見つかりませんでした。" };
  const place = meetingPlace(a, b, roster, record);
  const message = await meetupInviteLine({ kind: cand.kind, window: win, baseNumber: place?.baseNumber, areaPeople: view.area.people });
  const m: Meetup = {
    id: newId("mt"),
    date: today,
    fromId,
    toId,
    kind: cand.kind,
    window: win,
    ...(place ? { baseNumber: place.baseNumber, missionId: place.missionId } : {}),
    status: "proposed",
    message,
    createdAt: now.toISOString(),
  };
  await insertMeetup(m);
  // 相手には誘った人の呼び名だけ（誘った本人が同意している）。家の場所は出さない
  const bk = inboxKeyOf(b);
  const sent = bk ? await push(bk, MSG.nakamaInvite({ id: m.id, fromName: a.nickname, message, windowLabel: WINDOW_LABEL[win] })).catch(() => false) : false;
  return { ok: true, sent, text: "誘いを送りました。相手が「一緒にやる」を押したら成立します。返事がなくても、いつもどおり参加できます。" };
}

export type AnswerResult = { ok: boolean; text: string; matched?: { otherName: string; baseNumber?: number; missionId?: string } };

/** 誘いに答える（誘われた本人だけ）。「一緒にやる」で成立し、誘った人に知らせる。見送りは相手に理由を伝えない */
export async function answerMeetup(responderId: string, meetupId: string, accept: boolean, now: Date): Promise<AnswerResult> {
  const m = await getMeetup(meetupId);
  if (!m) return { ok: false, text: "その誘いは見つかりませんでした。" };
  if (accept) {
    const blocked = await blockedNow(now);
    if (blocked) return { ok: false, text: blocked };
  }
  const r = respond(m, responderId, accept, now);
  if (!r.ok) {
    const text = r.reason === "expired" ? "この誘いは期限が過ぎました。また次の機会に。" : r.reason === "closed" ? "この誘いにはもう答えています。" : "この誘いはあなた宛てではありません。";
    return { ok: false, text };
  }
  if (!(await updateMeetupStatus(m.id, r.meetup.status, now.toISOString()))) return { ok: false, text: "この誘いにはもう答えています。" };
  if (!accept) return { ok: true, text: "今回は見送りました。相手には理由は伝わりません。いつもどおり自由に参加できます。" };
  const roster = await loadRoster();
  const from = roster.participants.find((p) => p.id === m.fromId);
  const to = roster.participants.find((p) => p.id === m.toId);
  const fk = inboxKeyOf(from);
  if (fk) {
    await push(fk, MSG.nakamaMatched({ otherName: to?.nickname ?? "仲間", windowLabel: WINDOW_LABEL[m.window], baseNumber: m.baseNumber })).catch(() => false);
  }
  return {
    ok: true,
    text: "合流が決まりました！",
    matched: { otherName: from?.nickname ?? "仲間", baseNumber: m.baseNumber, missionId: m.missionId },
  };
}

// ---- 雪かきバトン ----

/** その地域で、今日現地で活動した人の数（ソロの台帳の 50m マスから。誰かは出さない） */
async function areaPeople(area: string, today: string): Promise<number> {
  try {
    const logs = await repo().listSoloLogsBetween(today, today);
    return new Set(logs.filter((l) => l.onsite && l.cellKey && areaOfCell(l.cellKey) === area).map((l) => l.participantId)).size;
  } catch {
    return 0;
  }
}

async function areaView(me: Participant, today: string, viewerId: string): Promise<AreaView> {
  const area = areaKey(me.location);
  try {
    const [batons, people] = await Promise.all([listBatons(today, area), areaPeople(area, today)]);
    const counts = await reactionsOf(batons.map((b) => b.id), viewerId);
    const last = batons.at(-1);
    return {
      people: Math.max(people, new Set(batons.map((b) => b.participantId)).size),
      story: last?.story,
      batons: batons
        .slice(-5)
        .reverse()
        .map((b) => {
          const c = counts.get(b.id) ?? { thanks: 0, continue: 0 };
          return {
            id: b.id,
            band: timeBand(b.at),
            where: SOURCE_LABEL[b.source],
            done: b.status === "done",
            message: b.message,
            photoChecked: b.photoChecked,
            thanks: c.thanks,
            cont: c.continue,
            mine: c.mine,
            own: b.participantId === viewerId,
          };
        }),
    };
  } catch (e) {
    console.error("[nakama] 地域のバトンを読めませんでした:", e instanceof Error ? e.message : e);
    return { people: 0, batons: [] };
  }
}

async function thanksFor(participantId: string, since: string): Promise<number> {
  try {
    const mine = await listBatonsBy(participantId, since);
    const c = await reactionsOf(mine.map((b) => b.id));
    return [...c.values()].reduce((a, x) => a + x.thanks, 0);
  } catch {
    return 0;
  }
}

/** 完了画面の「次の人へバトン」。地域は活動した場所（家の手伝いはその家、それ以外は本人の家）の約250m四方 */
export async function leaveBaton(
  participantId: string,
  input: { source: string; status: string; preset?: string; text?: string; photoChecked?: boolean; missionId?: string },
  now: Date,
): Promise<{ ok: boolean; text: string; story?: string }> {
  const [record, roster] = await Promise.all([loadMorning(), loadRoster()]);
  const me = roster.participants.find((p) => p.id === participantId);
  if (!me) return { ok: false, text: "登録が見つかりません。" };
  const source: BatonSource = input.source === "help_house" || input.source === "road" ? input.source : "own_house";
  const preset = BATON_PRESETS.find((p) => p === input.preset);
  let message: string | undefined = preset;
  if (input.text?.trim()) {
    const clean = cleanBatonText(input.text);
    if (!clean) return { ok: false, text: "名前・番号・場所の言い方は書けません（30字まで）。決まった言葉から選んでもOKです。" };
    message = preset ? `${preset}。${clean}` : clean;
  }
  if (!message) return { ok: false, text: "ひとことを選んでください。" };
  let where = me.location;
  if (source === "help_house" && input.missionId) {
    const m = record.morning.missions.find((x) => x.id === input.missionId);
    const base = m && roster.bases.find((b) => b.id === m.baseId);
    const home = base && roster.participants.find((p) => p.id === base.requesterId);
    if (home) where = home.location;
  }
  const today = appToday(record, now);
  const area = areaKey(where);
  const previous = (await listBatons(today, area)).filter((b) => b.participantId !== me.id);
  if ((await listBatons(today, area)).filter((b) => b.participantId === me.id).length >= 3) {
    return { ok: false, text: "この地域へのバトンは1日3回までです。ありがとうございました。" };
  }
  const people = Math.max(await areaPeople(area, today), new Set([...previous.map((b) => b.participantId), me.id]).size);
  const story = await batonStoryLine({ previous: previous.slice(-3), now: now.toISOString(), areaPeople: people });
  const b: Baton = {
    id: newId("bt"),
    participantId: me.id,
    date: today,
    area,
    source,
    status: input.status === "partial" ? "partial" : "done",
    message,
    photoChecked: Boolean(input.photoChecked),
    story,
    at: now.toISOString(),
  };
  await insertBaton(b);
  return { ok: true, text: "バトンを渡しました。次にこの地域で活動する人に届きます。", story };
}

/** 前の人のバトンに「ありがとう」「続きをやります」。自分のバトンには押せない。誰が押したかは出さない */
export async function reactToBaton(participantId: string, batonId: string, reaction: string): Promise<{ ok: boolean; text: string }> {
  if (reaction !== "thanks" && reaction !== "continue") return { ok: false, text: "その押し方はありません。" };
  const b = await getBaton(batonId);
  if (!b) return { ok: false, text: "そのバトンは見つかりませんでした。" };
  if (b.participantId === participantId) return { ok: false, text: "自分のバトンには押せません。" };
  const me = await repo().findParticipant(participantId);
  if (!me || areaKey(me.location) !== b.area) return { ok: false, text: "この地域の人だけが押せます。" };
  await setReaction(b.id, participantId, reaction);
  return { ok: true, text: reaction === "thanks" ? "「ありがとう」を届けました。" : "「続きをやります」を届けました。" };
}
