// 朝の流れの「本番の操作」。状態を読み、flow.ts で書き換え、保存し、LINE に送る。
// cron（/api/cron/*）と /admin のボタンの両方からここを呼ぶ。
import { issueCardsForMission, rerenderBacks } from "../cards/issue";
import { announceText } from "../claude/announce";
import { isThanksChoice, THANKS_CHOICES, thanksSentence, type ThanksChoice } from "../claude/thanks";
import { planMorning } from "../claude/commander";
import { checkPhoto, decidePhoto, SNOW_TYPE_LABEL, type PhotoInput } from "../claude/photo";
import { weeklyText } from "../claude/weekly";
import { scoreMission } from "../game/score";
import { shuffleTeams, weekStart, weeklySummary, type WeeklySummary } from "../game/week";
import { jstDate, jstMinutes, jstIso } from "../jst";
import { getProfileByAccessToken, multicast, push } from "../line/client";
import { MSG, text } from "../line/messages";
import type { LineMessage } from "../line/types";
import { repo } from "../repo";
import { getTeam } from "../teams";
import { TOWN } from "../town";
import type { HelperAnswer, Mission, Participant, PhotoCheck, RequesterAnswer, Role, Sortie } from "../types";
import { SNOW_THRESHOLD_CM, forecastSnowUntilMorning } from "../weather";
import { applyPlan, commanderInput, emptyMorning, putAnswer, ringRollcall, type MorningRecord, type ThanksRecord } from "./flow";
import { lineIds, loadRoster, type Roster } from "./roster";
import { archiveMorning, claimPlanning, listMornings, loadMorning, saveMorning } from "./store";
import { recapText } from "../claude/recap";
import { CHEER_CHOICES, parseCheer, type CheerChoice, type CheerRecord } from "./cheer";
import { summarizeClear, type ClearSummary } from "./clear";
import { buildRecapInput } from "./recap";
import { progress, snowHp, viewBases } from "./view";
import { viewCells } from "../cells";
import { emojiGrid } from "../share";
import {
  applyLateAnswer,
  goingCount,
  helpDue,
  helpState,
  missingPeople,
  pickHelpTargets,
  pickKnockTargets,
  pickTaskNow,
  radiusLabel,
  setHelpState,
} from "./watch";

/** 前夜の予告: 今朝の状態を作り直し、LINE のある全員に送る */
export async function announce(opts: { date: string; forecastCm: number }): Promise<MorningRecord> {
  const current = await loadMorning();
  // 前の朝の記録は日付で残す（週のまとめに使う）。見本やまっさらな朝は残さない
  if (current.morning.missions.length > 0 && current.morning.rollcall.date !== opts.date && current.answers.length > 0) {
    await archiveMorning(current);
  }
  const a = await announceText({ date: opts.date, forecastCm: opts.forecastCm });
  const s = emptyMorning({ ...opts, viewerId: current.morning.viewerId, announcement: a.text, snowName: a.snowName });
  const roster = await loadRoster();
  const ids = lineIds(roster.participants);
  await multicast(ids, [text(a.text)]);
  s.log.push(`予告を LINE で ${ids.length} 人に送信`);
  await saveMorning(s);
  return s;
}

/** 前夜 21:00 の cron: Open-Meteo を見て、基準を超えていたら予告する */
export async function checkForecastAndAnnounce(now = new Date()): Promise<{ forecastCm: number; announced: boolean; date: string }> {
  // 日曜の夜は、先に「今週の群れ」のまとめ（実況・称号・シャッフル）
  if (new Date(now.getTime() + 9 * 3600 * 1000).getUTCDay() === 0) await weeklyRecap(now);
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
  const status = s.morning.rollcall.status;
  if (status !== "open" && status !== "planned") return [MSG.rollcallClosed()];
  const value = /^rc:ans=([a-z0-9]+)$/.exec(data)?.[1] ?? "";
  const answer = p.role === "requester" ? REQUESTER_ANSWERS[value] : HELPER_ANSWERS[value];
  if (answer === undefined) return [p.role === "requester" ? MSG.rollcallRequester() : MSG.rollcallHelper()];
  if (status === "planned") {
    // 作戦配信のあとの答え（spec 4-c）: 「いいえ」なら人を集め、「はい」なら取り下げる
    const roster = await loadRoster();
    const late = applyLateAnswer(s, roster, p, answer, now.toISOString());
    s.log.push(`${p.nickname}さんが遅れて点呼に回答（${value}）`);
    await saveMorning(s);
    if (late.kind === "short") await notifyHelp(late.mission.id, now);
    if (late.kind === "fine") return [MSG.lateRequesterFine()];
    if (late.kind === "short") return [MSG.lateRequesterShort()];
    return [MSG.lateHelperThanks()];
  }
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
  // 開始 20 分前（6:40）の時点で足りない家はすぐヘルプ通知（spec 4-a）、返事なしの家は声かけと家族へ（spec 4）
  for (const m of s.morning.missions) {
    if (m.status === "short") await notifyHelp(m.id);
    if (m.status === "no_answer") await notifyNoAnswer(m.id);
  }
  return { record: await loadMorning(), sent };
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
  const becameShort = going < mission.requiredPeople && mission.status !== "done";
  if (becameShort) mission.status = "short";
  s.log.push(`${who}さんは今朝は行けない → 拠点${number}は ${going}/${mission.requiredPeople} 人`);
  await saveMorning(s);
  if (becameShort) await notifyHelp(mission.id, now);
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
  await notifyHelp(mission.id); // spec 4-b
  return [MSG.shortReported(number)];
}

export interface CompleteResult {
  done: boolean;
  /** 写真を送った人への返事 */
  messages: LineMessage[];
  /** 完了したときの MISSION CLEAR のまとめ（画面用） */
  clear?: ClearSummary;
  /** 写真では「まだ」→ もう一度か、「それでも完了にする」が選べる */
  retry?: boolean;
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
  const outcome = decidePhoto(check);
  if (outcome === "retry") {
    s.log.push(`拠点${number}の写真: まだ（${check.comment}）`);
    await saveMorning(s);
    return { done: false, retry: true, messages: [MSG.photoNotCleared(check.comment)] };
  }
  if (outcome === "accepted") {
    // 写真では判断できない → 本人の報告として受け付ける（AI を最終判定者にしない）
    check.comment = `写真では確かめきれませんでしたが、報告として受け付けました。${check.comment}`;
    s.log.push(`拠点${number}の写真: 判断できず → 報告として受け付け`);
  }
  return finishMission(s, roster, sortie, mission, check, participantId, now);
}

/** 「それでも完了にする」（LINE のボタン／地図のボタン）: 写真なしで、本人の報告として完了にする */
export async function completeManually(participantId: string, now = new Date()): Promise<CompleteResult> {
  const s = await loadMorning();
  const roster = await loadRoster();
  const sortie = s.morning.sorties.find((x) => x.participantId === participantId && x.status === "going");
  const mission = sortie && s.morning.missions.find((m) => m.id === sortie.missionId);
  if (!sortie || !mission) return { done: false, messages: [MSG.noSortie()] };
  s.log.push(`拠点${baseNumberOf(roster, mission.baseId)}: 本人の報告で完了（写真なし）`);
  const check: PhotoCheck = {
    cleared: true,
    passable: true,
    icy: false,
    uncertain: true,
    comment: "本人の報告で完了にしました（写真では確認していません）。お疲れさまでした。",
  };
  return finishMission(s, roster, sortie, mission, check, participantId, now);
}

/** 1軒を完了にする本体: 出撃を完了 → 得点 → カード → 依頼者・家族・仲間へ通知 → MISSION CLEAR のまとめ */
async function finishMission(
  s: MorningRecord,
  roster: Roster,
  sortie: Sortie,
  mission: Mission,
  check: PhotoCheck,
  participantId: string,
  now: Date,
): Promise<CompleteResult> {
  const number = baseNumberOf(roster, mission.baseId);
  const at = now.toISOString();
  const hpBefore = snowHp(s.morning).current;
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
  // その朝だけのカード（表・裏）を来た人の数だけ発行し、LINE で2枚送る（初出撃の人には歓迎も）
  try {
    const issued = await issueCardsForMission(s, roster, mission, sorties);
    s.firstFlights = [...new Set([...(s.firstFlights ?? []), ...issued.firstFlightIds])];
  } catch (e) {
    s.log.push(`カードの発行に失敗: ${e instanceof Error ? e.message : String(e)}`);
  }
  await saveMorning(s);

  // 依頼者へ（ありがとう点呼の3ボタン付き）、そして家族へ（spec 8）
  if (requester?.lineUserId) await push(requester.lineUserId, [MSG.requesterDoneNotice(names, mission.id)]);
  if (requester) {
    for (const link of await repo().listFamilyLinksByRequester(requester.id)) {
      if (link.familyLineUserId !== requester.lineUserId) await push(link.familyLineUserId, [MSG.familyDone(names, mission.id)]);
    }
  }
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
  if (check.snowType && check.snowType !== "unknown") reply.text += `\n雪質: ${SNOW_TYPE_LABEL[check.snowType]}。`;
  if (check.care) reply.text += `\n${check.care}`;
  const prog = progress(s.morning);
  if (prog.allDone) reply.text += `\n「${s.morning.rollcall.snowName ?? "今朝の雪"}」討伐！ ${prog.total}軒すべて終わりました。`;
  // 絵文字グリッド（マスの色だけ。そのまま LINE グループや X に貼れる）を返事に添える
  reply.text += `\n\n${emojiGrid(viewCells([...viewBases(s.morning).values()], roster), s.morning)}`;
  const clear =
    summarizeClear(s.morning, roster, mission.id, { hpBefore, viewerId: participantId, firstFlightIds: s.firstFlights }) ?? undefined;
  if (prog.allDone) await writeRecap().catch((e) => console.error("[recap]", e)); // 討伐したら今朝の実況を書く
  return { done: true, messages: [reply], clear };
}

// ---- ありがとう点呼（spec v1.1） ----

/**
 * お願いした人の3択を受け取る: 手伝った人の LINE に届け、Claude が一文に整えてカードの裏面を作り直す。点は付けない。
 * requesterId を省くと、その家の依頼者として扱う（/admin のデモ用）
 */
export async function applyThanks(
  missionId: string,
  choice: ThanksChoice,
  opts: { requesterId?: string; now?: Date } = {},
): Promise<{ ok: boolean; messages: LineMessage[]; record?: ThanksRecord }> {
  const now = opts.now ?? new Date();
  const s = await loadMorning();
  const roster = await loadRoster();
  const m = s.morning.missions.find((x) => x.id === missionId);
  const base = m && roster.bases.find((b) => b.id === m.baseId);
  if (!m || !base || m.status !== "done") return { ok: false, messages: [MSG.thanksNotFound()] };
  if (opts.requesterId && base.requesterId !== opts.requesterId) return { ok: false, messages: [MSG.thanksNotFound()] };
  const requester = roster.participants.find((p) => p.id === base.requesterId);
  const label = THANKS_CHOICES[choice];
  const sorties = s.morning.sorties.filter((x) => x.missionId === m.id);
  const completedAt = sorties.find((x) => x.completedAt)?.completedAt ?? now.toISOString();
  const sentence = await thanksSentence({
    label,
    completedAtJst: clockTextJst(new Date(completedAt)),
    memberCount: sorties.length,
    teamNames: [...new Set(sorties.map((x) => getTeam(x.teamId).name))],
    forecastCm: s.morning.rollcall.forecastCm,
  });
  // 手伝った人へ（1人1回のプッシュ）
  const byId = new Map(roster.participants.map((p) => [p.id, p]));
  let sentTo = 0;
  for (const x of sorties) {
    const p = byId.get(x.participantId);
    if (!p?.lineUserId) continue;
    await push(p.lineUserId, [MSG.thanksToHelper(requester?.nickname ?? "お願いした人", label, base.number, sentence)]);
    sentTo++;
  }
  const record: ThanksRecord = { choice, label, sentence, at: now.toISOString(), sentTo };
  s.thanks = { ...(s.thanks ?? {}), [m.id]: record };
  s.log.push(`拠点${base.number}: ありがとう点呼「${label}」→ ${sorties.length} 人（LINE ${sentTo} 人）。裏面: ${sentence}`);
  await saveMorning(s);
  try {
    await rerenderBacks(m.id, {
      date: s.morning.rollcall.date,
      thanks: sentence,
      subtasks: m.subtasks.map((t) => `${t.label}（${t.minutes}分）`),
    });
  } catch (e) {
    console.error("[thanks] 裏面を作り直せませんでした:", e instanceof Error ? e.message : e);
  }
  return { ok: true, messages: [MSG.thanksSent(label, sorties.length)], record };
}

// ---- 家族の応援スタンプ（spec v1.2） ----

/**
 * 家族の応援を受け取る: 手伝った人の LINE に届け、記録する。点は付けない。
 * familyLineUserId を渡すと、その家に紐づいた家族のときだけ受け付ける（/admin のデモでは省く）
 */
export async function applyCheer(
  missionId: string,
  choice: CheerChoice,
  opts: { familyLineUserId?: string; now?: Date } = {},
): Promise<{ ok: boolean; messages: LineMessage[]; record?: CheerRecord }> {
  const now = opts.now ?? new Date();
  const s = await loadMorning();
  const roster = await loadRoster();
  const m = s.morning.missions.find((x) => x.id === missionId);
  const base = m && roster.bases.find((b) => b.id === m.baseId);
  if (!m || !base || m.status !== "done") return { ok: false, messages: [MSG.cheerNotFound()] };
  if (opts.familyLineUserId) {
    const links = await repo().listFamilyLinksByRequester(base.requesterId);
    if (!links.some((l) => l.familyLineUserId === opts.familyLineUserId)) return { ok: false, messages: [MSG.cheerNotFound()] };
  }
  const requester = roster.participants.find((p) => p.id === base.requesterId);
  const label = CHEER_CHOICES[choice];
  const sorties = s.morning.sorties.filter((x) => x.missionId === m.id);
  const byId = new Map(roster.participants.map((p) => [p.id, p]));
  let sentTo = 0;
  for (const x of sorties) {
    const p = byId.get(x.participantId);
    if (!p?.lineUserId) continue;
    await push(p.lineUserId, [MSG.cheerToHelper(requester?.nickname ?? "お願いした人", label, base.number)]);
    sentTo++;
  }
  const record: CheerRecord = { choice, label, at: now.toISOString(), sentTo };
  s.cheers = { ...(s.cheers ?? {}), [m.id]: [...(s.cheers?.[m.id] ?? []), record] };
  s.log.push(`拠点${base.number}: ご家族から応援「${label}」→ ${sorties.length} 人（LINE ${sentTo} 人）`);
  await saveMorning(s);
  return { ok: true, messages: [MSG.cheerSent(label, sorties.length)], record };
}

/** LINE のボタン（cheer:<missionId>=<1|2|3>）: その家に紐づいた家族だけ */
export async function sendCheer(lineUserId: string, data: string, now = new Date()): Promise<LineMessage[]> {
  const parsed = parseCheer(data);
  if (!parsed) return [MSG.cheerNotFound()];
  return (await applyCheer(parsed.missionId, parsed.choice, { familyLineUserId: lineUserId, now })).messages;
}

/** LINE のボタン（thanks:<missionId>=<1|2|3>）: 押した人がその家の依頼者のときだけ */
export async function sendThanks(lineUserId: string, data: string, now = new Date()): Promise<LineMessage[]> {
  const p = await repo().findParticipantByLineUserId(lineUserId);
  if (!p) return [MSG.notRegistered()];
  const mt = /^thanks:(.+)=([123])$/.exec(data);
  if (!mt || !isThanksChoice(mt[2])) return [MSG.thanksNotFound()];
  return (await applyThanks(mt[1], mt[2], { requesterId: p.id, now })).messages;
}

/** 今朝の実況（spec v1.1 9-6）: 本当の集計だけを Claude に渡して3〜4文。全軒完了で自動、/admin のボタンでも */
export async function writeRecap(now = new Date()): Promise<string> {
  const s = await loadMorning();
  const roster = await loadRoster();
  const input = buildRecapInput(s, roster);
  const { text } = await recapText(input);
  s.recap = { text, at: now.toISOString(), allDone: input.allDone };
  s.log.push(`今朝の実況を書いた（${input.housesDone}/${input.housesTotal} 軒・${input.movers} 人）`);
  await saveMorning(s);
  return text;
}

// ---- ヘルプ通知と見守り（spec 4） ----

/** サポーター（町内会役員役）の LINE。環境変数 SUPPORTER_LINE_USER_IDS にカンマ区切りで */
function supporterIds(): string[] {
  return (process.env.SUPPORTER_LINE_USER_IDS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

/**
 * 人手が足りない家のヘルプ通知を1段階すすめる: 300m → 600m → 1km → サポーター。
 * 文面には「5分でもOK」の小タスクを添える。同じ人には2回送らない。
 */
export async function notifyHelp(missionId: string, now = new Date()): Promise<{ ring: string; notified: number } | null> {
  const s = await loadMorning();
  const roster = await loadRoster();
  const m = s.morning.missions.find((x) => x.id === missionId);
  if (!m || m.status === "done") return null;
  const state = helpState(s, m.id);
  if (state.stage >= 4) return null;
  const missing = missingPeople(s, m);
  if (missing <= 0) return null;
  const number = baseNumberOf(roster, m.baseId);
  const ring = state.stage; // 0..3
  if (ring === 3) {
    const ids = supporterIds();
    for (const id of ids) await push(id, [MSG.supporterRequest(number, missing)]);
    setHelpState(s, m.id, { ...state, stage: 4, lastAt: now.toISOString() });
    s.log.push(`拠点${number}: サポーターへ連絡（${ids.length > 0 ? `${ids.length} 人` : "未設定"}）`);
    await saveMorning(s);
    return { ring: radiusLabel(3), notified: ids.length };
  }
  const targets = pickHelpTargets(s, roster, m, ring as 0 | 1 | 2);
  const tasks = m.subtasks.filter((t) => t.minutes === 5).map((t) => `${t.label}（5分）`);
  let sent = 0;
  for (const t of targets) {
    if (!t.lineUserId) continue;
    await push(t.lineUserId, [MSG.helpRequest(m.id, number, missing, tasks.length ? tasks : ["偵察（5分）"])]);
    sent++;
  }
  setHelpState(s, m.id, {
    ...state,
    stage: (ring + 1) as 1 | 2 | 3,
    lastAt: now.toISOString(),
    notifiedIds: [...state.notifiedIds, ...targets.map((t) => t.id)],
  });
  s.log.push(
    `拠点${number}: ヘルプ通知 ${radiusLabel(ring)}（${targets.length} 人: ${targets.map((t) => t.nickname).join("・") || "該当なし"}、LINE ${sent} 人）`,
  );
  await saveMorning(s);
  return { ring: radiusLabel(ring), notified: targets.length };
}

/** 間に合っていない家のヘルプ通知を、5分おきに次の輪へ。Webhook と /admin のボタンから呼ぶ */
export async function escalateHelpIfDue(now = new Date()): Promise<number> {
  const s = await loadMorning();
  let n = 0;
  for (const m of s.morning.missions) {
    if (m.status !== "short") continue;
    if (!helpDue(helpState(s, m.id), now)) continue;
    if ((await notifyHelp(m.id, now)) !== null) n++;
  }
  return n;
}

/** 返事なしの家: 近所（300m）に「声かけお願い」、家族に「返事がありません」 */
export async function notifyNoAnswer(missionId: string): Promise<void> {
  const s = await loadMorning();
  const roster = await loadRoster();
  const m = s.morning.missions.find((x) => x.id === missionId);
  if (!m || m.status !== "no_answer") return;
  const state = helpState(s, m.id);
  if (state.knockIds && state.knockIds.length > 0) return; // 一度だけ
  const number = baseNumberOf(roster, m.baseId);
  const targets = pickKnockTargets(s, roster, m);
  for (const t of targets) if (t.lineUserId) await push(t.lineUserId, [MSG.knockRequest(m.id, number)]);
  const base = roster.bases.find((b) => b.id === m.baseId);
  let family = 0;
  if (base) {
    for (const link of await repo().listFamilyLinksByRequester(base.requesterId)) {
      await push(link.familyLineUserId, [MSG.familyNoAnswer()]);
      family++;
    }
  }
  setHelpState(s, m.id, { ...state, knockIds: targets.map((t) => t.id) });
  s.log.push(`拠点${number}: 返事なし → 声かけ依頼 ${targets.length} 人（${targets.map((t) => t.nickname).join("・") || "該当なし"}）、家族 ${family} 人に連絡`);
  await saveMorning(s);
}

/**
 * ヘルプ通知の「行く（5分でも）」と地図の「5分だけ助けに行く」: 出撃に加わる。自分の家を終えた人なら駆けつけボーナス。
 * extra: 人がそろっている家にも偵察・補給（5分）として加わる（「5分だけ参加」用）
 */
export async function joinMission(
  participantId: string,
  missionId: string,
  now = new Date(),
  opts: { extra?: boolean } = {},
): Promise<LineMessage[]> {
  const s = await loadMorning();
  const roster = await loadRoster();
  const m = s.morning.missions.find((x) => x.id === missionId);
  const p = roster.participants.find((x) => x.id === participantId);
  if (!m || !p?.teamId || m.status === "done") return [MSG.noSortie()];
  const number = baseNumberOf(roster, m.baseId);
  if (s.morning.sorties.some((x) => x.missionId === m.id && x.participantId === p.id && x.status === "going")) {
    return [MSG.helpJoined(number)];
  }
  const enough = missingPeople(s, m) <= 0;
  if (enough && !opts.extra) return [MSG.helpAlreadyEnough(number)];
  const finishedOwn = s.morning.sorties.some((x) => x.participantId === p.id && x.status === "done");
  s.morning.sorties.push({
    id: `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    missionId: m.id,
    participantId: p.id,
    teamId: p.teamId,
    subtaskIds: enough ? ["scout"] : [], // そろっている家に加わるときは偵察・補給の5分タスク
    status: "going",
    rescue: finishedOwn,
    confirmedAt: now.toISOString(),
  });
  if (goingCount(s, m.id) >= m.requiredPeople && m.status !== "no_answer") m.status = "in_progress";
  s.log.push(
    `${p.nickname}さんが${enough ? "偵察・補給で" : "ヘルプで"}拠点${number}へ（${goingCount(s, m.id)}/${m.requiredPeople} 人${finishedOwn ? "・駆けつけ" : ""}）`,
  );
  await saveMorning(s);
  return [MSG.helpJoined(number)];
}

export interface JoinNearbyResult {
  joined: boolean;
  messages: LineMessage[];
  baseNumber?: number | string;
}

/**
 * 地図の「5分だけ参加」: 近く（1km）で人手が足りない家があれば加わり、なければ作業中の家に偵察・補給（5分）で加わる。
 * どこかに向かっている最中の人には何も出さない（まず自分の家を）。
 */
export async function joinNearby(participantId: string, minutes: 5 | 15 | 30 = 5, now = new Date()): Promise<JoinNearbyResult> {
  const s = await loadMorning();
  const roster = await loadRoster();
  const p = roster.participants.find((x) => x.id === participantId);
  if (!p || p.role !== "helper" || !p.teamId || s.morning.rollcall.status !== "planned") {
    return { joined: false, messages: [MSG.nowNothing()] };
  }
  const offer = pickTaskNow(s, roster, p, minutes);
  if (!offer) return { joined: false, messages: [MSG.nowNothing()] };
  const messages = await joinMission(p.id, offer.mission.id, now, { extra: true });
  return { joined: true, messages, baseNumber: baseNumberOf(roster, offer.mission.baseId) };
}

// ---- 週末（spec 2 日曜・5・8・9-5） ----

export interface WeeklyRecapResult {
  summary: WeeklySummary;
  commentary: string;
  nextWeek: string;
  /** 翌週のチーム（手伝う側の ID → チーム） */
  nextTeams: Record<string, TeamIdStr>;
  sent: number;
}
type TeamIdStr = "salvia" | "marigold" | "lupinus";

/**
 * 日曜: 今週の実況・チーム順位・称号・週の目標ボーナス・翌週のシャッフル。
 * みんなに実況、称号の人にひとこと、手伝う側に来週のチーム、家族に今週の回数を LINE で。
 */
export async function weeklyRecap(now = new Date()): Promise<WeeklyRecapResult> {
  const today = jstDate(now);
  const from = weekStart(today);
  const roster = await loadRoster();
  const records = await listMornings(from, today);
  const summary = weeklySummary(records, roster, from, now.toISOString());
  const text = await weeklyText(summary);

  // 週の目標ボーナスは今朝の得点に足す（二重に足さないよう、同じ週のぶんがあれば入れ替える）
  const s = await loadMorning();
  s.morning.scores = [...s.morning.scores.filter((e) => e.reason !== "weekly_goal"), ...summary.goalEvents];

  // 翌週のチーム: 出撃回数と体力でバランス（Claude の案ではなく計算。週ごとの種で毎週変わる）
  const helpers = roster.participants.filter((p) => p.role === "helper");
  const seed = Number(from.replace(/-/g, "")) % 100000;
  const nextTeams = shuffleTeams(helpers, summary.sortieDays, seed);
  for (const h of helpers) {
    if (nextTeams[h.id] && nextTeams[h.id] !== h.teamId) await repo().upsertParticipant({ ...h, teamId: nextTeams[h.id] });
  }

  // LINE: 1人1回にまとめる（実況 → 称号 → 来週のチーム）
  let sent = 0;
  const titleOf = new Map(summary.titles.map((t) => [t.participantId, t]));
  for (const p of roster.participants) {
    if (!p.lineUserId) continue;
    const msgs: LineMessage[] = [MSG.weeklyToAll(text.commentary, text.nextWeek)];
    const title = titleOf.get(p.id);
    if (title) msgs.push(MSG.weeklyTitle(title.title, title.rareCard));
    if (p.role === "helper" && nextTeams[p.id]) {
      const team = getTeam(nextTeams[p.id]);
      msgs.push(MSG.weeklyNewTeam(team.name, team.colorName));
    }
    await push(p.lineUserId, msgs);
    sent++;
  }
  for (const [requesterId, count] of Object.entries(summary.helpedCount)) {
    const requester = roster.participants.find((p) => p.id === requesterId);
    for (const link of await repo().listFamilyLinksByRequester(requesterId)) {
      if (link.familyLineUserId === requester?.lineUserId) continue;
      await push(link.familyLineUserId, [MSG.weeklyFamily(count)]);
      sent++;
    }
  }
  s.weekly = { weekStart: from, commentary: text.commentary, nextWeek: text.nextWeek, ranking: summary.ranking, teamTotals: summary.teamTotals, titles: summary.titles, at: now.toISOString() };
  s.log.push(`${today} 今週の群れ: ${summary.days} 朝・${summary.missionsDone} 軒、称号 ${summary.titles.length} 人、チームを組み直し、LINE ${sent} 人`);
  await saveMorning(s);
  return { summary, commentary: text.commentary, nextWeek: text.nextWeek, nextTeams, sent };
}

/** 「いまからやる（5／15／30分）」: 近くの小タスクを1件さがして提案する */
export async function offerTaskNow(participantId: string, minutes: 5 | 15 | 30): Promise<LineMessage[]> {
  const s = await loadMorning();
  const roster = await loadRoster();
  const p = roster.participants.find((x) => x.id === participantId);
  if (!p || p.role !== "helper") return [MSG.nowNothing()];
  if (s.morning.rollcall.status !== "planned") return [MSG.nowNothing()];
  const offer = pickTaskNow(s, roster, p, minutes);
  if (!offer) return [MSG.nowNothing()];
  const number = baseNumberOf(roster, offer.mission.baseId);
  s.log.push(`${p.nickname}さんに「いまからやる」: 拠点${number} ${offer.label}（${offer.minutes}分）`);
  await saveMorning(s);
  return [MSG.nowOffer(offer.mission.id, number, offer.label, offer.minutes, offer.distanceM)];
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
