// 朝の流れの「本番の操作」。状態を読み、flow.ts で書き換え、保存し、LINE に送る。
// cron（/api/cron/*）と /admin のボタンの両方からここを呼ぶ。
import { announceText } from "../claude/announce";
import { planMorning } from "../claude/commander";
import { checkPhoto, type PhotoInput } from "../claude/photo";
import { scoreMission } from "../game/score";
import { jstDate, jstMinutes, jstIso } from "../jst";
import { getProfileByAccessToken, multicast, push } from "../line/client";
import { MSG, text } from "../line/messages";
import type { LineMessage } from "../line/types";
import { repo } from "../repo";
import { getTeam } from "../teams";
import { TOWN } from "../town";
import type { HelperAnswer, Participant, RequesterAnswer, Role } from "../types";
import { SNOW_THRESHOLD_CM, forecastSnowUntilMorning } from "../weather";
import { applyPlan, commanderInput, emptyMorning, putAnswer, ringRollcall, type MorningRecord } from "./flow";
import { lineIds, loadRoster, type Roster } from "./roster";
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
  for (const m of s.messages) add(byId.get(m.participantId), MSG.planForHelper(m.text));
  for (const m of s.morning.missions) {
    const base = roster.bases.find((b) => b.id === m.baseId);
    const requester = base && byId.get(base.requesterId);
    if (!requester || m.status === "no_answer") continue;
    const names = s.morning.sorties.filter((x) => x.missionId === m.id).map((x) => byId.get(x.participantId)?.nickname ?? "");
    add(requester, MSG.planForRequester("7:00", names.filter(Boolean)));
  }
  // 1人1回のプッシュにまとめる（町内へのまとめ → 個別の文面。ボタンは最後の文面に付くので個別を後ろに）
  let sent = 0;
  for (const id of lineIds(roster.participants)) {
    await push(id, [text(s.briefing), ...(personal.get(id) ?? [])]);
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

// ---- 朝の一本道: 行く → 写真で完了 → 得点 → 依頼者へ通知 ----

function baseNumberOf(roster: Roster, baseId: string): number | string {
  return roster.bases.find((b) => b.id === baseId)?.number ?? "?";
}

/** 「行く」「今朝は行けない」。行けない人は外し、足りなくなった家は人手不足にする */
export async function setGoing(participantId: string, go: boolean, now = new Date()): Promise<LineMessage[]> {
  const s = await loadMorning();
  const roster = await loadRoster();
  const sortie = s.morning.sorties.find((x) => x.participantId === participantId && x.status === "going");
  if (!sortie) return [MSG.noSortie()];
  const mission = s.morning.missions.find((m) => m.id === sortie.missionId);
  if (!mission) return [MSG.noSortie()];
  const number = baseNumberOf(roster, mission.baseId);
  const who = roster.participants.find((p) => p.id === participantId)?.nickname ?? participantId;
  if (go) {
    sortie.confirmedAt = now.toISOString();
    if (mission.status === "assigned") mission.status = "in_progress";
    s.log.push(`${who}さんが拠点${number}へ「行く」`);
    await saveMorning(s);
    return [MSG.goConfirmed(number)];
  }
  s.morning.sorties = s.morning.sorties.filter((x) => x.id !== sortie.id);
  const going = s.morning.sorties.filter((x) => x.missionId === mission.id).length;
  if (going < mission.requiredPeople && mission.status !== "done") mission.status = "short";
  s.log.push(`${who}さんは今朝は行けない → 拠点${number}は ${going}/${mission.requiredPeople} 人`);
  await saveMorning(s);
  return [MSG.goDeclined()];
}

/** 現場の「人手が足りない」ボタン */
export async function reportShort(participantId: string): Promise<LineMessage[]> {
  const s = await loadMorning();
  const roster = await loadRoster();
  const sortie = s.morning.sorties.find((x) => x.participantId === participantId && x.status === "going");
  const mission = sortie && s.morning.missions.find((m) => m.id === sortie.missionId);
  if (!mission) return [MSG.noSortie()];
  mission.status = "short";
  const number = baseNumberOf(roster, mission.baseId);
  s.log.push(`拠点${number}から「人手が足りない」`);
  await saveMorning(s);
  return [MSG.shortReported(number)];
}

export interface CompleteResult {
  done: boolean;
  /** 写真を送った人への返事 */
  messages: LineMessage[];
}

/**
 * 写真1枚で1軒を完了にする（spec 2）。Claude が写真を確認 → その家の出撃を全部完了 → 得点 → 依頼者と仲間に通知。
 */
export async function completeWithPhoto(participantId: string, image: PhotoInput, now = new Date()): Promise<CompleteResult> {
  const s = await loadMorning();
  const roster = await loadRoster();
  const sortie = s.morning.sorties.find((x) => x.participantId === participantId && x.status === "going");
  const mission = sortie && s.morning.missions.find((m) => m.id === sortie.missionId);
  if (!sortie || !mission) return { done: false, messages: [MSG.noSortie()] };

  const check = await checkPhoto(image);
  const number = baseNumberOf(roster, mission.baseId);
  if (!check.cleared || !check.passable) {
    s.log.push(`拠点${number}の写真: まだ（${check.comment}）`);
    await saveMorning(s);
    return { done: false, messages: [MSG.photoNotCleared(check.comment)] };
  }

  const at = now.toISOString();
  const sorties = s.morning.sorties.filter((x) => x.missionId === mission.id);
  for (const x of sorties) {
    x.status = "done";
    x.completedAt = at;
  }
  sortie.photoCheck = check;
  mission.status = "done";
  const base = roster.bases.find((b) => b.id === mission.baseId);
  const requester = base && roster.participants.find((p) => p.id === base.requesterId);
  const requesterJoined = s.answers.some((a) => a.participantId === requester?.id && a.answer === "together");
  const events = scoreMission(sorties, at, requesterJoined);
  s.morning.scores.push(...events);
  s.clockMin = Math.max(s.clockMin, jstMinutes(now));
  const byId = new Map(roster.participants.map((p) => [p.id, p]));
  const names = sorties.map((x) => byId.get(x.participantId)?.nickname ?? "").filter(Boolean);
  const me = byId.get(participantId);
  const pointsOf = (teamId: string) => events.filter((e) => e.teamId === teamId).reduce((a, e) => a + e.points, 0);
  s.log.push(`${clockTextJst(now)} 拠点${number} 完了（${names.join("・")}）写真: ${check.comment}`);
  await saveMorning(s);

  // 依頼者へ（家族への通知は T12）
  if (requester?.lineUserId) await push(requester.lineUserId, [MSG.requesterDoneNotice(names)]);
  // 一緒に行った仲間へ
  for (const x of sorties) {
    if (x.participantId === participantId) continue;
    const p = byId.get(x.participantId);
    if (p?.lineUserId) {
      await push(p.lineUserId, [MSG.doneByOther(number, me?.nickname ?? "仲間", getTeam(x.teamId).name, pointsOf(x.teamId))]);
    }
  }
  const myTeam = me?.teamId ? getTeam(me.teamId) : undefined;
  const reply = myTeam
    ? MSG.doneThanks(number, myTeam.name, pointsOf(myTeam.id), check.comment)
    : text(`${check.comment}\n拠点${number} 完了！`);
  if (check.icy) reply.text += "\n凍っているところがあるようです。砂をまくと安心です。";
  return { done: true, messages: [reply] };
}

function clockTextJst(d: Date): string {
  const m = jstMinutes(d);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** LIFF のアクセストークンから「この地図を見ている参加者」を決める */
export async function resolveViewerByLiff(accessToken: string): Promise<Participant | undefined> {
  const profile = await getProfileByAccessToken(accessToken);
  if (!profile) return undefined;
  return repo().findParticipantByLineUserId(profile.userId);
}

export { jstIso };
