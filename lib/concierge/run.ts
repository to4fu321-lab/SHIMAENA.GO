// AI参加コンシェルジュの本体（spec v1.7）: 自由な文 → その人の今の状況 → 開いている参加の方法 → Claude が1つ選ぶ（3往復まで）
// → その人用の画像つきのカードで、アプリの活動へ誘う。返信（reply）だけで完結するので、LINE の月の通数は使わない。
import { isNight } from "../night";
import { onTeam } from "../member";
import { askConcierge, MAX_TURNS, topicsFor, type ConciergeInput } from "../claude/concierge";
import { jstHourMinute } from "../jst";
import { youImagePath } from "../line/you-image";
import type { LineMessage } from "../line/types";
import type { MorningRecord } from "../morning/flow";
import { loadMorning } from "../morning/store";
import { lastTipAt } from "../morning/tips";
import { appToday } from "../morning/today";
import { repo } from "../repo";
import { safetyLine } from "../safety";
import type { Participant } from "../types";
import { baseUrl } from "../url";
import { conciergeAsk, conciergePick } from "./messages";
import { currentWeather, weatherOf } from "../sky";
import { TOWN } from "../town";
import { depthAt, fetchHourlySnow, sumSnowfall } from "../weather";
import { BODY_WORDS, buildOptions, type ConciergeContext } from "./options";
import { addVoice } from "../voice/store";
import { loadProfile, updateProfile } from "./profile";
import { clearSession, loadSession, saveSession } from "./session";
import { appNow } from "@/lib/clock";

/** その人の今の状況（名前・場所は含めない） */
export async function conciergeContext(p: Participant, record: MorningRecord, now: Date): Promise<ConciergeContext> {
  const m = record.morning;
  const today = appToday(record, now);
  const isToday = m.rollcall.date === today;
  const r = repo();
  const [logs, cards] = await Promise.all([
    r.listSoloLogsByParticipant(p.id).catch(() => []),
    r.listCardsByRecipient(p.id).catch(() => []),
  ]);
  let tipOk = false;
  if (p.role === "requester") {
    const last = await lastTipAt(p.id);
    tipOk = last === undefined || now.getTime() - Date.parse(last) > 14 * 86400000;
  }
  const rc = m.rollcall;
  const profile = await loadProfile(p.id).catch(() => undefined);
  return {
    motives: profile?.motives ?? [],
    role: p.role === "requester" ? "requester" : "helper",
    hasTeam: onTeam(p),
    rollcall: isToday ? rc.status : "none",
    answered: record.answers.some((a) => a.participantId === p.id),
    going: m.sorties.some((x) => x.participantId === p.id && x.status === "going"),
    shortHouses: isToday ? m.missions.filter((x) => x.status === "short").length : 0,
    soloDoneToday: logs.filter((l) => l.date === today).map((l) => l.kind),
    safety: isToday && Boolean(safetyLine({ cm: rc.forecastCm, tempMinC: rc.tempMinC, windMaxMs: rc.windMaxMs })),
    firstTime: logs.length === 0 && cards.length === 0,
    tipOk,
    night: isNight(now),
  };
}

/** 町のいまの天気と、この先24時間の雪（Open-Meteo）。隊長が「今日は雪ある？」に答えられるように。失敗したら分かる分だけ */
export async function conciergeWeather(now: Date): Promise<NonNullable<ConciergeInput["weather"]>> {
  const [cur, hourly] = await Promise.all([
    currentWeather(TOWN.center).catch(() => ({}) as Awaited<ReturnType<typeof currentWeather>>),
    fetchHourlySnow(TOWN.center, (u, init) => fetch(u, { ...init, signal: AbortSignal.timeout(2500) })).catch(() => undefined),
  ]);
  const label = { snow: "雪", cloudy: "くもり", clear: "晴れ" } as const;
  const hour = jstHourMinute(now).slice(0, 13) + ":00"; // "2026-12-13T07:00"
  const later = jstHourMinute(new Date(now.getTime() + 24 * 3600000)).slice(0, 13) + ":00";
  return {
    now: cur.code === undefined ? "不明" : label[weatherOf(cur.code)],
    ...(cur.tempC !== undefined ? { tempC: Math.round(cur.tempC) } : {}),
    ...(hourly ? { snowNext24hCm: sumSnowfall(hourly, hour, later) } : {}),
    ...(hourly && depthAt(hourly, hour) !== undefined ? { depthCm: depthAt(hourly, hour) } : {}),
  };
}

/**
 * 登録した人の自由な文に答える。登録していない人・お願いする側でも手伝う側でもない人は null（登録の会話へ）。
 */
export async function concierge(lineUserId: string, text: string, now = appNow(), opts: { force?: boolean } = {}): Promise<LineMessage[] | null> {
  const p = await repo().findParticipantByLineUserId(lineUserId);
  if (!p || (p.role !== "helper" && p.role !== "requester")) return null;
  const record = await loadMorning();
  const today = appToday(record, now);
  const ctx = await conciergeContext(p, record, now);
  const options = buildOptions(ctx);
  const session = await loadSession(lineUserId, now);
  // force: 聞き返さずに1つ選ぶ（「出動する」で家がなかったとき。spec v1.10）
  const turn = opts.force ? MAX_TURNS : Math.min(MAX_TURNS, (session?.turn ?? 0) + 1);
  const rc = record.morning.rollcall;
  const weather = await conciergeWeather(now).catch(() => undefined);
  const input: ConciergeInput = {
    turn,
    role: ctx.role,
    firstTime: ctx.firstTime,
    snowCm: ctx.rollcall === "none" ? 0 : rc.forecastCm,
    safety: ctx.safety,
    hour: Number(jstHourMinute(now).slice(11, 13)),
    options: options.map(({ id, title, minutes, points, about, motives }) => ({ id, title, minutes, points, about, motives })),
    history: session?.history ?? [],
    text: text.slice(0, 200),
    ...(weather ? { weather } : {}),
    profile: { motives: ctx.motives ?? [], summary: (await loadProfile(p.id).catch(() => undefined))?.summary ?? "" },
    recent: session?.shown ?? [],
    topics: topicsFor(now, turn),
  };
  const res = await askConcierge(input, options);
  // その人の方向と要約を残す（spec v1.17。新しく読み取れたときだけ入れ替える。体のことばの文からは残さない）
  if (!res.guarded && (res.motives.length > 0 || res.summary)) await updateProfile(p.id, { motives: res.motives, summary: res.summary }, now).catch(() => undefined);
  // 声を貯める（spec v1.17）: 求められていることが読み取れたときだけ1件（原文は残さない）
  if (!res.guarded && res.voice) await addVoice({ participantId: p.id, date: today, category: res.voice.category, summary: res.voice.text, motives: res.motives, ...(res.option ? { picked: res.option.id } : {}) }, now).catch(() => undefined);

  if (res.option) {
    await clearSession(lineUserId);
    const img = youImagePath({
      sky: res.sky,
      prop: res.option.prop,
      caption: res.caption,
      title: res.option.title,
      minutes: res.option.minutes,
      points: res.option.points,
      teamId: onTeam(p) ? p.teamId : undefined,
    });
    const outside = res.option.id === "own_house" || res.option.id === "patrol" || res.option.id === "join";
    const safety = ctx.safety && outside ? "大雪・寒さの朝です。ひとりでやらず、15分ごとに休みましょう。" : undefined;
    return conciergePick(res.reply, res.option, `${baseUrl()}${img}`, safety, res.why);
  }
  // まだ選べない: 聞き返して、続きを10分だけ覚えておく（体のことばを含む文は残さない）
  await saveSession(lineUserId, {
    turn,
    history: [...(session?.history ?? []), { user: BODY_WORDS.test(text) ? "（体のこと）" : text.slice(0, 100), captain: `${res.reply} ${res.question ?? ""}`.trim() }].slice(-MAX_TURNS),
    at: now.toISOString(),
    shown: res.suggest.map((o) => o.id),
  });
  return conciergeAsk(res.reply, res.question ?? "今日は、外に出られそうですか？", res.suggest.length > 0 ? res.suggest : options);
}

/** コンシェルジュの続きの会話があるか（あれば自由な文は先にコンシェルジュへ） */
export async function inConversation(lineUserId: string, now = appNow()): Promise<boolean> {
  return Boolean(await loadSession(lineUserId, now));
}

/** 相談らしい文か（点呼の時間でも、点呼の答えより先にコンシェルジュへ回す） */
export const CONSULT_WORDS = /何すれば|なにすれば|何したら|なにしたら|どうしたら|何しよう|ひま|暇|雪(は|が)?(ない|降|ふ|どう|ある)|天気|積雪|分からない|わからない|何から|なにから|初めて|はじめて|どうすれば|何をすれば|なにをすれば|何ができ|なにができ|できること|手伝いたい|参加したい|参加できる|応援したい|教えたい|コツ|迷って|不安/;
