// 朝の流れの「本番の操作」。状態を読み、flow.ts で書き換え、保存し、LINE に送る。
// cron（/api/cron/*）と /admin のボタンの両方からここを呼ぶ。
import { announceText } from "../claude/announce";
import { planMorning } from "../claude/commander";
import { jstDate, jstMinutes, jstIso } from "../jst";
import { multicast, push } from "../line/client";
import { MSG, text } from "../line/messages";
import type { LineMessage } from "../line/types";
import { repo } from "../repo";
import { TOWN } from "../town";
import type { HelperAnswer, Participant, RequesterAnswer, Role } from "../types";
import { SNOW_THRESHOLD_CM, forecastSnowUntilMorning } from "../weather";
import { applyPlan, commanderInput, emptyMorning, putAnswer, ringRollcall, type MorningRecord } from "./flow";
import { lineIds, loadRoster } from "./roster";
import { claimPlanning, loadMorning, saveMorning } from "./store";

/** 前夜の予告: 今朝の状態を作り直し、LINE のある全員に送る */
export async function announce(opts: { date: string; forecastCm: number }): Promise<MorningRecord> {
  const current = await loadMorning();
  const announcement = await announceText({ date: opts.date, forecastCm: opts.forecastCm });
  const s = emptyMorning({ ...opts, viewerId: current.morning.viewerId, announcement });
  const roster = await loadRoster();
  const ids = lineIds(roster.participants);
  await multicast(ids, [text(announcement)]);
  s.log.push(`予告を LINE で ${ids.length} 人に送信`);
  await saveMorning(s);
  return s;
}

/** 前夜 21:00 の cron: Open-Meteo を見て、基準を超えていたら予告する */
export async function checkForecastAndAnnounce(now = new Date()): Promise<{ forecastCm: number; announced: boolean; date: string }> {
  const f = await forecastSnowUntilMorning(TOWN.center, now);
  if (f.snowfallCm < SNOW_THRESHOLD_CM) {
    const s = await loadMorning();
    s.log.push(`予報 ${f.snowfallCm}cm（${f.until} まで）→ 基準 ${SNOW_THRESHOLD_CM}cm 未満なので予告なし`);
    await saveMorning(s);
    return { forecastCm: f.snowfallCm, announced: false, date: f.morningDate };
  }
  await announce({ date: f.morningDate, forecastCm: Math.round(f.snowfallCm) });
  return { forecastCm: f.snowfallCm, announced: true, date: f.morningDate };
}

/** 6:30 の点呼: 役割ごとの1問を LINE のある全員に送る */
export async function ring(): Promise<{ record: MorningRecord; sent: number }> {
  const s = await loadMorning();
  if (s.morning.rollcall.status !== "announced") return { record: s, sent: 0 };
  ringRollcall(s);
  const roster = await loadRoster();
  const of = (role: Role) => lineIds(roster.participants.filter((p) => p.role === role));
  const requesters = of("requester");
  const helpers = of("helper");
  await multicast(requesters, [MSG.rollcallRequester()]);
  await multicast(helpers, [MSG.rollcallHelper()]);
  const sent = requesters.length + helpers.length;
  s.log.push(`点呼を LINE で ${sent} 人に送信`);
  await saveMorning(s);
  return { record: s, sent };
}

const REQUESTER_ANSWERS: Record<string, RequesterAnswer> = { yes: "yes", no: "no", together: "together" };
const HELPER_ANSWERS: Record<string, HelperAnswer> = { "0": 0, "15": 15, "30": 30, "60": 60 };

/** LINE のボタン（rc:ans=...）で届いた点呼の答えを記録する */
export async function answerRollcall(lineUserId: string, data: string, now = new Date()): Promise<LineMessage[]> {
  const p = await repo().findParticipantByLineUserId(lineUserId);
  if (!p) return [MSG.notRegistered()];
  const s = await loadMorning();
  if (s.morning.rollcall.status !== "open") return [MSG.rollcallClosed()];
  const value = /^rc:ans=([a-z0-9]+)$/.exec(data)?.[1] ?? "";
  const answer = p.role === "requester" ? REQUESTER_ANSWERS[value] : HELPER_ANSWERS[value];
  if (answer === undefined) return [p.role === "requester" ? MSG.rollcallRequester() : MSG.rollcallHelper()];
  putAnswer(s, p.id, answer, now.toISOString());
  s.log.push(`${p.nickname}さんが点呼に回答（${value}）`);
  await saveMorning(s);
  return [MSG.rollcallThanks(value)];
}

/** 6:40 の作戦: 司令官（Claude かモック）→ ミッションと出撃 → LINE で配信 */
export async function plan(): Promise<{ record: MorningRecord; sent: number }> {
  if (!(await claimPlanning())) return { record: await loadMorning(), sent: 0 };
  const s = await loadMorning();
  s.morning.rollcall.status = "open"; // claim で planned にしたぶんを戻し、applyPlan で改めて planned にする
  const roster = await loadRoster();
  try {
    const result = await planMorning(commanderInput(s, roster));
    applyPlan(s, roster, result);
  } catch (e) {
    await saveMorning(s); // open に戻して、もう一度押せるようにする
    throw e;
  }
  const byId = new Map(roster.participants.map((p) => [p.id, p]));
  const personal = new Map<string, LineMessage[]>();
  const add = (p: Participant | undefined, m: LineMessage) => {
    if (!p?.lineUserId) return;
    personal.set(p.lineUserId, [...(personal.get(p.lineUserId) ?? []), m]);
  };
  for (const m of s.messages) add(byId.get(m.participantId), text(m.text));
  for (const m of s.morning.missions) {
    const base = roster.bases.find((b) => b.id === m.baseId);
    const requester = base && byId.get(base.requesterId);
    if (!requester || m.status === "no_answer") continue;
    const names = s.morning.sorties.filter((x) => x.missionId === m.id).map((x) => byId.get(x.participantId)?.nickname ?? "");
    add(requester, MSG.planForRequester("7:00", names.filter(Boolean)));
  }
  // 1人1回のプッシュにまとめる（個別の文面＋町内へのまとめ）
  let sent = 0;
  for (const id of lineIds(roster.participants)) {
    await push(id, [...(personal.get(id) ?? []), text(s.briefing)]);
    sent++;
  }
  s.log.push(`作戦を LINE で ${sent} 人に送信`);
  await saveMorning(s);
  return { record: s, sent };
}

/**
 * 6:40 を過ぎても点呼が開いたままなら作戦を配信する（Hobby プランの cron は1日2本までで 6:40 の分が置けないため、
 * 点呼の答えが届いたときにここを通す）。デモの日付（過去・未来）には反応しない。
 */
export async function planIfDue(now = new Date()): Promise<boolean> {
  const s = await loadMorning();
  if (s.morning.rollcall.status !== "open") return false;
  if (s.morning.rollcall.date !== jstDate(now) || jstMinutes(now) < 6 * 60 + 40) return false;
  await plan();
  return true;
}

export { jstIso };
