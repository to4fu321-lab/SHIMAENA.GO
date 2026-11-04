// 朝の流れの「本番の操作」。状態を読み、flow.ts で書き換え、保存し、LINE に送る。
// cron（/api/cron/*）と /admin のボタンの両方からここを呼ぶ。
import { isNight } from "../night";
import { onTeam } from "../member";
import { consistentSnowType } from "../snow-estimate";
import { issueCardsForMission, rerenderBacks, revealOf } from "../cards/issue";
import type { RevealCard } from "../cards/reveal";
import { announceText } from "../claude/announce";
import { isThanksChoice, THANKS_CHOICES, thanksSentence, type ThanksChoice } from "../claude/thanks";
import { planMorning } from "../claude/commander";
import { checkPhoto, decidePhoto, hazardLines, SNOW_TYPE_LABEL, WIDTH_LABEL, type PhotoInput } from "../claude/photo";
import { photoFingerprint, photoSeen, rememberPhoto } from "../ops/photo-seen";
import { weeklyText } from "../claude/weekly";
import { readWords, requestLabel } from "../claude/words";
import { safetyLine } from "../safety";
import { captainLines } from "../claude/captain";
import { pickTeacher } from "../claude/teacher";
import { inviteDrafts } from "../claude/invite";
import { lineShareUrl } from "../share-links";
import { baseUrl } from "../url";
import { addTip, lastTipAt, loadTips } from "./tips";
import { scoreMission } from "../game/score";
import { shuffleTeams, weekStart, weeklySummary, type WeeklySummary } from "../game/week";
import { jstDate, jstHourMinute, jstMinutes, jstIso } from "../jst";
import { getProfileByAccessToken, multicast, push } from "../line/client";
import { MSG } from "../line/messages";
import type { LineMessage } from "../line/types";
import { mapsUrl } from "../nav";
import { repo } from "../repo";
import { getTeam } from "../teams";
import { nextTeamTerm } from "../team-theme";
import { TOWN } from "../town";
import type { NowMinutes } from "./watch";
import type { HelperAnswer, HelperWhen, Mission, Participant, PhotoCheck, RequestNote, RequesterAnswer, Role, Sortie } from "../types";
import { SNOW_THRESHOLD_CM, fetchHourlySnow, forecastSnowUntilMorning, sumSnowfall } from "../weather";
import { activeHelpers, MAX_ROUNDS, reopenDone } from "./rounds";
import { decompose, importance, requiredPeople } from "../game/mission";
import { recordProblem } from "../ops/problems";
import { applyPlan, autoAnswerProxyHomes, commanderInput, DEMO_DATE, emptyMorning, putAnswer, requestDay, ringRollcall, type MorningRecord, type ThanksRecord } from "./flow";
import { lineIds, loadRoster, type Roster } from "./roster";
import { archiveMorning, claimPlanning, listMornings, loadMorning, saveMorning } from "./store";
import { recapText } from "../claude/recap";
import { CHEER_CHOICES, parseCheer, type CheerChoice, type CheerRecord } from "./cheer";
import { summarizeClear, withInvites, type ClearSummary } from "./clear";
import { buildRecapInput } from "./recap";
import { progress, snowHp, viewBases } from "./view";
import { viewCells } from "../cells";
import { emojiGrid } from "../share";
import { listSoloScores } from "../solo/team-points";
import { recordHouseFeathers } from "../solo/ops";
import { refreshShareTextsLater } from "../sns/refresh";
import { appToday } from "./today";
import {
  applyLateAnswer,
  goingCount,
  helpDue,
  helpState,
  missingPeople,
  pickAskTargets,
  pickHelpTargets,
  pickKnockTargets,
  pickTaskNow,
  radiusLabel,
  setHelpState,
} from "./watch";

/** 前の朝の記録は日付で残す（週のまとめに使う）。見本やまっさらな朝は残さない */
async function archiveIfReal(current: MorningRecord, nextDate: string): Promise<void> {
  if (current.morning.missions.length > 0 && current.morning.rollcall.date !== nextDate && current.answers.length > 0) {
    await archiveMorning(current);
  }
}

/** 前夜の予告: 今朝の状態を作り直し、LINE のある全員に送る */
export async function announce(opts: { date: string; forecastCm: number; tempMinC?: number; windMaxMs?: number; depthCm?: number }): Promise<MorningRecord> {
  const current = await loadMorning();
  await archiveIfReal(current, opts.date);
  const a = await announceText({ date: opts.date, forecastCm: opts.forecastCm });
  const s = emptyMorning({ ...opts, viewerId: current.morning.viewerId, announcement: a.text, snowName: a.snowName });
  const roster = await loadRoster();
  const ids = lineIds(roster.participants);
const ok =   await multicast(ids, MSG.announce(a.text, opts.forecastCm, a.snowName, safetyLine({ cm: opts.forecastCm, tempMinC: opts.tempMinC, windMaxMs: opts.windMaxMs }))); // 予告はシマエナ隊長のカード1枚に
  s.log.push(ok ? `予告を LINE で ${ids.length} 人に送信` : "⚠ 予告を LINE で送れませんでした（/admin の「問題」を見てください）");
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
  await announce({ date: f.morningDate, forecastCm: Math.round(f.snowfallCm), tempMinC: f.tempMinC, windMaxMs: f.windMaxMs, depthCm: f.depthCm });
  return { forecastCm: f.snowfallCm, announced: true, date: f.morningDate };
}

/** 6:30 の点呼: 役割ごとの1問を LINE のある全員に送る */
export async function ring(): Promise<{ record: MorningRecord; sent: number }> {
  const s = await loadMorning();
  if (s.morning.rollcall.status !== "announced") return { record: s, sent: 0 };
  ringRollcall(s);
  // 隊長のひとこと（状態ごと）をこの朝に1回だけ書く。失敗しても点呼は止めない（定型が出る）
  try {
    const rc = s.morning.rollcall;
    s.captainLines = await captainLines({ snowCm: rc.forecastCm, snowName: rc.snowName, safety: Boolean(rcArgs(s)[2]) });
  } catch (e) {
    console.error("[captain] 隊長のひとことを書けませんでした（定型を使います）:", e instanceof Error ? e.message : e);
  }
  const roster = await loadRoster();
  autoAnswerProxyHomes(s, roster, new Date().toISOString());
  const of = (role: Role) => lineIds(roster.participants.filter((p) => p.role === role));
  const requesters = of("requester");
  const helpers = of("helper");
  const okR = await multicast(requesters, MSG.rollcallRequester(...rcArgs(s)));
  const okH = await multicast(helpers, MSG.rollcallHelper(...rcArgs(s)));
  const sent = (okR ? requesters.length : 0) + (okH ? helpers.length : 0);
  if (!okR || !okH) s.log.push("⚠ 点呼の一部が LINE で送れませんでした（/admin の「問題」を見てください）");
  s.log.push(`点呼を LINE で ${sent} 人に送信`);
  await saveMorning(s);
  return { record: s, sent };
}

const REQUESTER_ANSWERS: Record<string, RequesterAnswer> = { yes: "yes", no: "no", together: "together" };
// v1.7: 10・20・30・60分。前の版のボタン（5・15）が押されても受け付ける
const HELPER_ANSWERS: Record<string, HelperAnswer> = { "0": 0, "5": 5, "10": 10, "15": 15, "20": 20, "30": 30, "60": 60, am: 20, noon: 20, pm: 20 };
// v1.8: いつ手伝えそうか（朝・お昼・夕方）。分の答え（前の版）は朝として扱う
const HELPER_WHEN: Record<string, HelperWhen> = { am: "am", noon: "noon", pm: "pm" };

/** LINE のボタン（rc:ans=...）で届いた点呼の答えを記録する */
export async function answerRollcall(lineUserId: string, data: string, now = new Date()): Promise<LineMessage[]> {
  const p = await repo().findParticipantByLineUserId(lineUserId);
  if (!p) return MSG.notRegistered();
  const s = await loadMorning();
  const status = s.morning.rollcall.status;
  if (status !== "open" && status !== "planned") return MSG.rollcallClosed();
  const value = /^rc:ans=([a-z0-9]+)$/.exec(data)?.[1] ?? "";
  const answer = p.role === "requester" ? REQUESTER_ANSWERS[value] : HELPER_ANSWERS[value];
  if (answer === undefined) return p.role === "requester" ? MSG.rollcallRequester(...rcArgs(s)) : MSG.rollcallHelper(...rcArgs(s));
  if (status === "planned") {
    // 作戦配信のあとの答え（spec 4-c）: 「いいえ」なら人を集め、「はい」なら取り下げる
    const roster = await loadRoster();
    const late = applyLateAnswer(s, roster, p, answer, now.toISOString());
    const mine = s.answers.find((a) => a.participantId === p.id);
    if (mine && p.role === "helper" && HELPER_WHEN[value]) mine.when = HELPER_WHEN[value];
    s.log.push(`${p.nickname}さんが遅れて点呼に回答（${value}）`);
    await saveMorning(s);
    if (late.kind === "short") await notifyHelp(late.mission.id, now);
    if (late.kind === "fine") return MSG.lateRequesterFine();
    if (late.kind === "short") return MSG.lateRequesterShort();
    return MSG.lateHelperThanks();
  }
  putAnswer(s, p.id, answer, now.toISOString(), p.role === "helper" ? HELPER_WHEN[value] : undefined);
  s.log.push(`${p.nickname}さんが点呼に回答（${value}）`);
  await saveMorning(s);
  // お願いする側には、まだ教えてもらっていなければ（または2週間ぶりなら）雪かきのコツを聞く（任意、spec v1.6）
  const last = p.role === "requester" ? await lastTipAt(p.id) : "skip";
  const askTip = last === undefined || (last !== "skip" && now.getTime() - Date.parse(last) > 14 * 86400000);
  return [...MSG.rollcallThanks(value), ...(askTip ? MSG.tipAsk() : [])];
}

/** 今朝の先生: 「教える」→ 待つ。「また今度」→ そのまま */
export async function tipStart(lineUserId: string, data: string): Promise<LineMessage[]> {
  const p = await repo().findParticipantByLineUserId(lineUserId);
  if (!p) return MSG.notRegistered();
  if (data !== "tip:ask") return MSG.tipLater();
  const s = await loadMorning();
  s.awaitingTip = [...(s.awaitingTip ?? []).filter((x) => x !== p.id), p.id];
  await saveMorning(s);
  return MSG.tipPrompt();
}

/** 「教える」を押した人の次の文をコツとして受け取る。待っていなければ null */
export async function tipReceive(lineUserId: string, text: string, now = new Date()): Promise<LineMessage[] | null> {
  const p = await repo().findParticipantByLineUserId(lineUserId);
  const s = await loadMorning();
  if (!p || !s.awaitingTip?.includes(p.id)) return null;
  s.awaitingTip = s.awaitingTip.filter((x) => x !== p.id);
  const ok = await addTip(p.id, text, now);
  if (ok) s.log.push(`${p.nickname}さんが雪かきのコツを教えてくれた`);
  await saveMorning(s);
  return MSG.tipThanks(ok);
}

/** コンシェルジュの「今朝の点呼に答える」: その人の役割の点呼の質問をもう一度出す（点呼の時間でなければ締め切りの案内） */
export async function rollcallQuestion(lineUserId: string): Promise<LineMessage[]> {
  const p = await repo().findParticipantByLineUserId(lineUserId);
  if (!p) return MSG.notRegistered();
  const s = await loadMorning();
  const status = s.morning.rollcall.status;
  if (status !== "open" && status !== "planned") return MSG.rollcallClosed();
  return p.role === "requester" ? MSG.rollcallRequester(...rcArgs(s)) : MSG.rollcallHelper(...rcArgs(s));
}

/** 隊長カードに渡す今朝の雪（量・名前・安全の一文） */
function rcArgs(s: MorningRecord): [number, string | undefined, string | undefined] {
  const rc = s.morning.rollcall;
  return [rc.forecastCm, rc.snowName, safetyLine({ cm: rc.forecastCm, tempMinC: rc.tempMinC, windMaxMs: rc.windMaxMs })];
}

/**
 * ことばで答える・頼む（spec v1.6）: 点呼の時間に送られたふつうの文を、点呼の答えと段取りにする。
 * 点呼の時間でなければ null（ふだんの案内に回す）。
 */
export async function answerByWords(lineUserId: string, text: string, now = new Date()): Promise<LineMessage[] | null> {
  const p = await repo().findParticipantByLineUserId(lineUserId);
  if (!p || (p.role !== "requester" && p.role !== "helper")) return null;
  const s0 = await loadMorning();
  const status = s0.morning.rollcall.status;
  if (status !== "open" && status !== "planned") return null;
  const w = await readWords({ text, role: p.role });
  if (w.answer === "unknown") {
    const question = p.role === "requester" ? MSG.rollcallRequester(...rcArgs(s0)) : MSG.rollcallHelper(...rcArgs(s0));
    return [...MSG.wordsAskBack(w.askBack ?? "もう一度、下のボタンで教えてください。"), question.at(-1)!];
  }
  const replyMsgs = await answerRollcall(lineUserId, `rc:ans=${w.answer}`, now);
  const request: RequestNote = {
    ...(w.deadline ? { deadline: w.deadline } : {}),
    ...(w.area ? { area: w.area } : {}),
    ...(w.note ? { note: w.note } : {}),
  };
  const hasRequest = p.role === "requester" && w.answer !== "yes" && Object.keys(request).length > 0;
  if (hasRequest) {
    const s = await loadMorning();
    const a = s.answers.find((x) => x.participantId === p.id);
    if (a) a.request = request;
    const base = (await loadRoster()).bases.find((b) => b.requesterId === p.id);
    const m = base && s.morning.missions.find((x) => x.baseId === base.id);
    if (m) m.request = request;
    s.log.push(`${p.nickname}さんがことばで依頼（${requestLabel(request) || request.note}）`);
    await saveMorning(s);
  }
  return [...MSG.wordsHeard(p.role, w.answer, hasRequest ? requestLabel(request) : ""), ...replyMsgs];
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
  // 今朝の先生: 町のコツから今朝の雪に合う1つ（失敗しても作戦は止めない）
  try {
    const rc = s.morning.rollcall;
    const pick = await pickTeacher({ cm: rc.forecastCm, tempMinC: rc.tempMinC, tips: await loadTips() });
    s.teacherTip = pick ? { line: pick.line } : undefined;
  } catch (e) {
    console.error("[teacher] 今朝の先生を選べませんでした:", e instanceof Error ? e.message : e);
  }
  const byId = new Map(roster.participants.map((p) => [p.id, p]));
  const personal = new Map<string, LineMessage[]>();
  const add = (p: Participant | undefined, m: LineMessage[]) => {
    if (!p?.lineUserId) return;
    personal.set(p.lineUserId, [...(personal.get(p.lineUserId) ?? []), ...m]);
  };
  for (const m of s.messages) add(byId.get(m.participantId), MSG.planForHelper(m.text));
  for (const m of s.morning.missions) {
    const base = roster.bases.find((b) => b.id === m.baseId);
    const requester = base && byId.get(base.requesterId);
    if (!requester || m.status === "no_answer") continue;
    const names = s.morning.sorties.filter((x) => x.missionId === m.id).map((x) => byId.get(x.participantId)?.nickname ?? "");
    add(requester, MSG.planForRequester("7:00", names.filter(Boolean)));
  }
  // 1人1回のプッシュにまとめる。1つの吹き出しに1つの話題（v1.4）:
  // 隊長カード（おはよう・今朝の雪）→（手伝う側）「助けてほしい家が○軒」「10分だけでも大歓迎！」→ 個別の文面（ボタンは最後）
  // 町内へのまとめ（s.briefing、シマエナ隊長の文）は /admin と記録に残す。LINE は短くする
  const houses = s.morning.missions.filter((m) => m.status !== "no_answer").length;
  let sent = 0;
  let failed = 0;
  for (const p of roster.participants) {
    if (!p.lineUserId) continue;
    const mine = personal.get(p.lineUserId) ?? [];
    const head = MSG.morningHello(...rcArgs(s));
    const body = p.role === "helper" ? [...MSG.housesToday(houses, mine.length === 0), ...mine] : mine;
    if (await push(p.lineUserId, [...head, ...body])) sent++;
    else failed++;
  }
  s.log.push(`作戦を LINE で ${sent} 人に送信${failed > 0 ? `（⚠ ${failed} 人に送れず。/admin の「問題」を見てください）` : ""}`);
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

/** 向かう本人にだけ渡す、家までの道順 URL */
function routeTo(roster: Roster, baseId: string, participantId: string): string | undefined {
  const base = roster.bases.find((b) => b.id === baseId);
  const requester = base && roster.participants.find((p) => p.id === base.requesterId);
  const me = roster.participants.find((p) => p.id === participantId);
  return requester ? mapsUrl(requester.location, me?.location) : undefined;
}

function baseNumberOf(roster: Roster, baseId: string): number | string {
  return roster.bases.find((b) => b.id === baseId)?.number ?? "?";
}

/** 「行く」「今朝は行けない」。行けない人は外し、足りなくなった家は人手不足にする */
export async function setGoing(participantId: string, go: boolean, now = new Date()): Promise<LineMessage[]> {
  if (go && isNight(now)) return MSG.nightOwnHouseOnly(); // 夜はよその家に行かない（spec v1.8 防犯）
  const s = await loadMorning();
  const roster = await loadRoster();
  const sortie = s.morning.sorties.find((x) => x.participantId === participantId && x.status === "going");
  if (!sortie) return MSG.noSortie();
  const mission = s.morning.missions.find((m) => m.id === sortie.missionId);
  if (!mission) return MSG.noSortie();
  const number = baseNumberOf(roster, mission.baseId);
  const who = roster.participants.find((p) => p.id === participantId)?.nickname ?? participantId;
  if (go) {
    sortie.confirmedAt = now.toISOString();
    if (mission.status === "assigned") mission.status = "in_progress";
    s.log.push(`${who}さんが拠点${number}へ「行く」`);
    await saveMorning(s);
    return MSG.goConfirmed(number, routeTo(roster, mission.baseId, participantId), mission.request, s.teacherTip?.line);
  }
  s.morning.sorties = s.morning.sorties.filter((x) => x.id !== sortie.id);
  const going = s.morning.sorties.filter((x) => x.missionId === mission.id).length;
  const becameShort = going < mission.requiredPeople && mission.status !== "done";
  if (becameShort) mission.status = "short";
  s.log.push(`${who}さんは今朝は行けない → 拠点${number}は ${going}/${mission.requiredPeople} 人`);
  await saveMorning(s);
  if (becameShort) await notifyHelp(mission.id, now);
  return MSG.goDeclined();
}

/** 現場の「人手が足りない」ボタン */
export async function reportShort(participantId: string): Promise<LineMessage[]> {
  const s = await loadMorning();
  const roster = await loadRoster();
  const sortie = s.morning.sorties.find((x) => x.participantId === participantId && x.status === "going");
  const mission = sortie && s.morning.missions.find((m) => m.id === sortie.missionId);
  if (!mission) return MSG.noSortie();
  mission.status = "short";
  const number = baseNumberOf(roster, mission.baseId);
  s.log.push(`拠点${number}から「人手が足りない」`);
  await saveMorning(s);
  await notifyHelp(mission.id); // spec 4-b
  return MSG.shortReported(number);
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
  if (!sortie || !mission) return { done: false, messages: MSG.noSortie() };

  const number = baseNumberOf(roster, mission.baseId);
  // 同じ日に同じ写真がもう受け付けられていたら、Claude を呼ばずに別の写真をお願いする（使い回しを防ぐ）
  const day = appToday(s, now);
  const fp = photoFingerprint(image.bytes);
  if (await photoSeen(day, fp)) {
    s.log.push(`拠点${number}の写真: 前に受け付けた写真と同じ → 撮り直しをお願い`);
    await saveMorning(s);
    return { done: false, retry: true, messages: MSG.photoNotCleared("前に送られた写真と同じでした。いまの玄関前から道路側を、新しく撮ってください。") };
  }
  const check = await checkPhoto(image);
  // 雪質が気温と食い違えば「ふつうの雪」に戻す（写真の見た目だけで決めつけない。spec v1.8）
  const type = consistentSnowType(check.snowType, s.morning.rollcall.tempMinC);
  if (type !== check.snowType) {
    check.snowType = type;
    check.snowTypeReason = undefined;
  }
  const outcome = decidePhoto(check);
  if (outcome === "retry") {
    s.log.push(`拠点${number}の写真: ${check.unrelated ? "雪かきの場所ではない" : "まだ"}（${check.comment}）`);
    await saveMorning(s);
    const ask = check.unrelated ? `${check.comment}玄関前から道路側を写してください。` : check.comment;
    return { done: false, retry: true, messages: MSG.photoNotCleared(ask) };
  }
  await rememberPhoto(day, fp);
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
  if (!sortie || !mission) return { done: false, messages: MSG.noSortie() };
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
  const events = scoreMission(sorties, at, requesterJoined, s.morning.rollcall.forecastCm);
  s.morning.scores.push(...events);
  s.clockMin = Math.max(s.clockMin, jstMinutes(now));
  const byId = new Map(roster.participants.map((p) => [p.id, p]));
  const names = sorties.map((x) => byId.get(x.participantId)?.nickname ?? "").filter(Boolean);
  const me = byId.get(participantId);
  const pointsOf = (teamId: string) => events.filter((e) => e.teamId === teamId).reduce((a, e) => a + e.points, 0);
  s.log.push(`${clockTextJst(now)} 拠点${number} 完了（${names.join("・")}）写真: ${check.comment}`);
  // その時だけのカード（表・裏）を来た人の数だけ発行し、LINE で2枚送る（初出撃の人には歓迎も）
  let myCard: RevealCard | undefined;
  try {
    const issued = await issueCardsForMission(s, roster, mission, sorties);
    s.firstFlights = [...new Set([...(s.firstFlights ?? []), ...issued.firstFlightIds])];
    const mine = issued.cards.find((c) => c.recipientId === participantId);
    if (mine) myCard = revealOf(mine, s.morning.rollcall.date, issued.sceneCode);
  } catch (e) {
    s.log.push(`カードの発行に失敗: ${e instanceof Error ? e.message : String(e)}`);
  }
  await saveMorning(s);
  // 来た人の個人の記録（羽）にも残す。チーム得点は上の scoreMission のまま（別の台帳）
  await recordHouseFeathers(
    sorties.flatMap((x) => (byId.get(x.participantId) ? [byId.get(x.participantId)!] : [])),
    { missionId: mission.id, baseLocation: requester?.location, today: appToday(s, now), now },
  );

  // 依頼者へ（ありがとう点呼の3ボタン付き）、そして家族へ（spec 8）
  if (requester?.lineUserId) await push(requester.lineUserId, MSG.requesterDoneNotice(names, mission.id));
  if (requester) {
    for (const link of await repo().listFamilyLinksByRequester(requester.id)) {
      if (link.familyLineUserId !== requester.lineUserId) await push(link.familyLineUserId, MSG.familyDone(names, mission.id));
    }
  }
  // 一緒に行った仲間へ
  for (const x of sorties) {
    if (x.participantId === participantId) continue;
    const p = byId.get(x.participantId);
    if (p?.lineUserId) {
      await push(p.lineUserId, MSG.doneByOther(number, me?.nickname ?? "仲間", getTeam(x.teamId).name, pointsOf(x.teamId)));
    }
  }
  const myTeam = me?.teamId ? getTeam(me.teamId) : undefined;
  const notes: string[] = [];
  if (check.snowType && check.snowType !== "unknown") notes.push(`雪質: ${SNOW_TYPE_LABEL[check.snowType]}${check.snowTypeReason ? `（${check.snowTypeReason}）` : ""}。`);
  if (check.care) notes.push(check.care);
  if (check.evidence) notes.push(`Claude の確認: ${check.evidence}${check.width && check.width !== "unknown" ? `（${WIDTH_LABEL[check.width]}）` : ""}`);
  notes.push(...hazardLines(check).map((x) => `⚠️ ${x}`));
  const prog = progress(s.morning);
  // あなたが主役の招待文（spec v1.6）: 写真を送った本人の今朝の活動から3案。失敗しても完了は止めない
  let invites: string[] | undefined;
  try {
    const minutes = Number(s.answers.find((a) => a.participantId === participantId)?.answer) || 5;
    invites = await inviteDrafts({
      minutes: Math.min(60, Math.max(5, minutes)),
      firstTime: (s.firstFlights ?? []).includes(participantId),
      snowCm: s.morning.rollcall.forecastCm,
      snowName: s.morning.rollcall.snowName,
      teamName: myTeam?.name,
    });
    s.invites = { ...(s.invites ?? {}), [participantId]: invites };
    await saveMorning(s);
  } catch (e) {
    console.error("[invite] 招待文を書けませんでした:", e instanceof Error ? e.message : e);
  }
  const joinUrl = process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL || `${baseUrl()}/public/town?via=invite`;
  // 1つの吹き出しに1つの話題: 完了 → ひとこと → 雪質と労い → 点 → 絵文字グリッド（そのまま LINE グループや X に貼れる）
  const reply = MSG.doneReport({
    baseNumber: number,
    comment: check.comment,
    notes,
    team: myTeam ? { name: myTeam.name, points: pointsOf(myTeam.id) } : undefined,
    allDoneLine: prog.allDone ? `今朝の家は ${prog.total}軒すべて終わりました。町じゅうに灯りがともりました！` : undefined,
    grid: emojiGrid(viewCells([...viewBases(s.morning).values()], roster), s.morning),
    inviteUrl: invites?.[0] ? lineShareUrl(invites[0], joinUrl) : undefined,
  });
  const clear =
    withInvites(summarizeClear(s.morning, roster, mission.id, { hpBefore, viewerId: participantId, firstFlightIds: s.firstFlights }), invites) ?? undefined;
  if (clear && myCard) clear.card = myCard;
  if (prog.allDone) await writeRecap().catch((e) => console.error("[recap]", e)); // 討伐したら今朝の実況を書く
  await refreshShareTextsLater(); // 数字が変わったので SNS の投稿文を作り直す（返事のあとで）
  return { done: true, messages: reply, clear };
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
  if (!m || !base || m.status !== "done") return { ok: false, messages: MSG.thanksNotFound() };
  if (opts.requesterId && base.requesterId !== opts.requesterId) return { ok: false, messages: MSG.thanksNotFound() };
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
    if (await push(p.lineUserId, MSG.thanksToHelper(requester?.nickname ?? "お願いした人", label, base.number, sentence))) sentTo++;
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
  return { ok: true, messages: MSG.thanksSent(label, sorties.length), record };
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
  if (!m || !base || m.status !== "done") return { ok: false, messages: MSG.cheerNotFound() };
  if (opts.familyLineUserId) {
    const links = await repo().listFamilyLinksByRequester(base.requesterId);
    if (!links.some((l) => l.familyLineUserId === opts.familyLineUserId)) return { ok: false, messages: MSG.cheerNotFound() };
  }
  const requester = roster.participants.find((p) => p.id === base.requesterId);
  const label = CHEER_CHOICES[choice];
  const sorties = s.morning.sorties.filter((x) => x.missionId === m.id);
  const byId = new Map(roster.participants.map((p) => [p.id, p]));
  let sentTo = 0;
  for (const x of sorties) {
    const p = byId.get(x.participantId);
    if (!p?.lineUserId) continue;
    if (await push(p.lineUserId, MSG.cheerToHelper(requester?.nickname ?? "お願いした人", label, base.number))) sentTo++;
  }
  const record: CheerRecord = { choice, label, at: now.toISOString(), sentTo };
  s.cheers = { ...(s.cheers ?? {}), [m.id]: [...(s.cheers?.[m.id] ?? []), record] };
  s.log.push(`拠点${base.number}: ご家族から応援「${label}」→ ${sorties.length} 人（LINE ${sentTo} 人）`);
  await saveMorning(s);
  return { ok: true, messages: MSG.cheerSent(label, sorties.length), record };
}

/** LINE のボタン（cheer:<missionId>=<1|2|3>）: その家に紐づいた家族だけ */
export async function sendCheer(lineUserId: string, data: string, now = new Date()): Promise<LineMessage[]> {
  const parsed = parseCheer(data);
  if (!parsed) return MSG.cheerNotFound();
  return (await applyCheer(parsed.missionId, parsed.choice, { familyLineUserId: lineUserId, now })).messages;
}

/** LINE のボタン（thanks:<missionId>=<1|2|3>）: 押した人がその家の依頼者のときだけ */
export async function sendThanks(lineUserId: string, data: string, now = new Date()): Promise<LineMessage[]> {
  const p = await repo().findParticipantByLineUserId(lineUserId);
  if (!p) return MSG.notRegistered();
  const mt = /^thanks:(.+)=([123])$/.exec(data);
  if (!mt || !isThanksChoice(mt[2])) return MSG.thanksNotFound();
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
  await refreshShareTextsLater();
  return text;
}

// ---- ヘルプ通知と見守り（spec 4） ----

/** サポーター（町内会役員役）の LINE。環境変数 SUPPORTER_LINE_USER_IDS にカンマ区切りで */
function supporterIds(): string[] {
  return (process.env.SUPPORTER_LINE_USER_IDS ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

/**
 * 人手が足りない家のヘルプ通知を1段階すすめる: 300m → 600m → 1km → サポーター。
 * 文面には「10分でもOK」の小タスクを添える。同じ人には2回送らない。
 */
export async function notifyHelp(missionId: string, now = new Date()): Promise<{ ring: string; notified: number } | null> {
  const s = await loadMorning();
  const roster = await loadRoster();
  const m = s.morning.missions.find((x) => x.id === missionId);
  if (!m || m.status === "done") return null;
  if (m.ask) return null; // 「雪かきを頼む」の家は 300m の1回だけ（月の通数を守る）
  const state = helpState(s, m.id);
  if (state.stage >= 4) return null;
  const missing = missingPeople(s, m);
  if (missing <= 0) return null;
  const number = baseNumberOf(roster, m.baseId);
  const ring = state.stage; // 0..3
  if (ring === 3) {
    const ids = supporterIds();
    for (const id of ids) await push(id, MSG.supporterRequest(number, missing));
    setHelpState(s, m.id, { ...state, stage: 4, lastAt: now.toISOString() });
    s.log.push(`拠点${number}: サポーターへ連絡（${ids.length > 0 ? `${ids.length} 人` : "未設定"}）`);
    await saveMorning(s);
    return { ring: radiusLabel(3), notified: ids.length };
  }
  const targets = pickHelpTargets(s, roster, m, ring as 0 | 1 | 2);
  const tasks = m.subtasks.filter((t) => t.minutes === 10).map((t) => `${t.label}（10分）`);
  let sent = 0;
  for (const t of targets) {
    if (!t.lineUserId) continue;
    if (await push(t.lineUserId, MSG.helpRequest(m.id, number, missing, tasks.length ? tasks : ["偵察（10分）"]))) sent++;
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
    if (m.status !== "short" || m.ask) continue;
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
  for (const t of targets) if (t.lineUserId) await push(t.lineUserId, MSG.knockRequest(m.id, number));
  const base = roster.bases.find((b) => b.id === m.baseId);
  let family = 0;
  if (base) {
    for (const link of await repo().listFamilyLinksByRequester(base.requesterId)) {
      await push(link.familyLineUserId, MSG.familyNoAnswer());
      family++;
    }
  }
  setHelpState(s, m.id, { ...state, knockIds: targets.map((t) => t.id) });
  s.log.push(`拠点${number}: 返事なし → 声かけ依頼 ${targets.length} 人（${targets.map((t) => t.nickname).join("・") || "該当なし"}）、家族 ${family} 人に連絡`);
  await saveMorning(s);
}

/**
 * ヘルプ通知の「行く（10分でも）」と地図の「10分だけ助けに行く」: 出撃に加わる。自分の家を終えた人なら駆けつけボーナス。
 * extra: 人がそろっている家にも偵察・補給（10分）として加わる（「10分だけ参加」用）
 */
export async function joinMission(
  participantId: string,
  missionId: string,
  now = new Date(),
  opts: { extra?: boolean } = {},
): Promise<LineMessage[]> {
  if (isNight(now)) return MSG.nightOwnHouseOnly(); // 夜はよその家に行かない（spec v1.8 防犯）
  const s = await loadMorning();
  const roster = await loadRoster();
  const m = s.morning.missions.find((x) => x.id === missionId);
  const p = roster.participants.find((x) => x.id === participantId);
  if (!m || !p?.teamId || m.status === "done") return MSG.noSortie();
  const number = baseNumberOf(roster, m.baseId);
  if (s.morning.sorties.some((x) => x.missionId === m.id && x.participantId === p.id && x.status === "going")) {
    return MSG.helpJoined(number, routeTo(roster, m.baseId, p.id), m.request, s.teacherTip?.line);
  }
  const enough = missingPeople(s, m) <= 0;
  if (enough && !opts.extra) return MSG.helpAlreadyEnough(number);
  const finishedOwn = s.morning.sorties.some((x) => x.participantId === p.id && x.status === "done");
  s.morning.sorties.push({
    id: `s${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
    missionId: m.id,
    participantId: p.id,
    teamId: p.teamId,
    subtaskIds: enough ? ["scout"] : [], // そろっている家に加わるときは偵察・補給の10分タスク
    status: "going",
    rescue: finishedOwn,
    confirmedAt: now.toISOString(),
  });
  if (goingCount(s, m.id) >= m.requiredPeople && m.status !== "no_answer") m.status = "in_progress";
  s.log.push(
    `${p.nickname}さんが${enough ? "偵察・補給で" : "ヘルプで"}拠点${number}へ（${goingCount(s, m.id)}/${m.requiredPeople} 人${finishedOwn ? "・駆けつけ" : ""}）`,
  );
  await saveMorning(s);
  return MSG.helpJoined(number, routeTo(roster, m.baseId, p.id), m.request, s.teacherTip?.line);
}

export interface JoinNearbyResult {
  joined: boolean;
  messages: LineMessage[];
  baseNumber?: number | string;
}

/**
 * 地図の「10分だけ参加」: 近く（1km）で人手が足りない家があれば加わり、なければ作業中の家に偵察・補給（10分）で加わる。
 * どこかに向かっている最中の人には何も出さない（まず自分の家を）。
 */
export async function joinNearby(participantId: string, minutes: NowMinutes = 10, now = new Date()): Promise<JoinNearbyResult> {
  if (isNight(now)) return { joined: false, messages: MSG.nightOwnHouseOnly() };
  const s = await loadMorning();
  const roster = await loadRoster();
  const p = roster.participants.find((x) => x.id === participantId);
  if (!p || !onTeam(p) || s.morning.rollcall.status !== "planned") {
    return { joined: false, messages: MSG.nowNothing() };
  }
  const offer = pickTaskNow(s, roster, p, minutes);
  if (!offer) return { joined: false, messages: MSG.nowNothing() };
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
  const summary = weeklySummary(records, roster, from, now.toISOString(), await listSoloScores(from, today));
  const text = await weeklyText(summary);

  // 週の目標ボーナスは今朝の得点に足す（二重に足さないよう、同じ週のぶんがあれば入れ替える）
  const s = await loadMorning();
  s.morning.scores = [...s.morning.scores.filter((e) => e.reason !== "weekly_goal"), ...summary.goalEvents];

  // 翌週のチーム: 出撃回数と体力でバランス（Claude の案ではなく計算。週ごとの種で毎週変わる）
  const helpers = roster.participants.filter((p) => p.role === "helper" || onTeam(p));
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
    const msgs: LineMessage[] = MSG.weeklyToAll(text.commentary, text.nextWeek);
    const title = titleOf.get(p.id);
    if (title) msgs.push(...MSG.weeklyTitle(title.title, title.rareCard));
    if (nextTeams[p.id]) {
      msgs.push(...MSG.weeklyNewTeam(nextTeams[p.id], nextTeamTerm(today)));
    }
    if (await push(p.lineUserId, msgs)) sent++;
  }
  for (const [requesterId, count] of Object.entries(summary.helpedCount)) {
    const requester = roster.participants.find((p) => p.id === requesterId);
    for (const link of await repo().listFamilyLinksByRequester(requesterId)) {
      if (link.familyLineUserId === requester?.lineUserId) continue;
      if (await push(link.familyLineUserId, MSG.weeklyFamily(count))) sent++;
    }
  }
  s.weekly = { weekStart: from, commentary: text.commentary, nextWeek: text.nextWeek, ranking: summary.ranking, teamTotals: summary.teamTotals, titles: summary.titles, at: now.toISOString() };
  s.log.push(`${today} 今週の群れ: ${summary.days} 朝・${summary.missionsDone} 軒、称号 ${summary.titles.length} 人、チームを組み直し、LINE ${sent} 人`);
  await saveMorning(s);
  return { summary, commentary: text.commentary, nextWeek: text.nextWeek, nextTeams, sent };
}

/** 「出動する（10／20／30／60分）」: 近くの小タスクを1件さがして提案する */
// ---- 雪かきを頼む（spec v1.10）: 6〜19時いつでも ----

/** 知らせる範囲・1人1日の回数・1回で知らせる人数（月 200 通の無料枠を守る） */
export const ASK_DAILY_CAP = 3;
export const ASK_MAX_RECIPIENTS = 5;

/**
 * お願いする側の「雪かきを頼む」: その人の家を今日の雪かき待ちにして地図に出し、300m 以内の手伝える人へ LINE で知らせる。
 * 雪の朝でない日は、その日の記録を新しく始める（出動・写真・完了・カードの流れはそのまま使える）。
 */
export async function askForHelp(lineUserId: string, now = new Date()): Promise<LineMessage[]> {
  if (isNight(now)) return MSG.askNight();
  const roster = await loadRoster();
  const p = roster.participants.find((x) => x.lineUserId === lineUserId);
  if (!p) return MSG.notRegistered();
  if (p.role !== "requester") return MSG.askHelperOnly();
  const base = roster.bases.find((b) => b.requesterId === p.id);
  if (!base) return MSG.notRegistered();

  let s = await loadMorning();
  // 見本の朝（デモ）ならその中に、そうでなければ本当の今日の記録に（前の雪の日の記録には足さない）
  const today = s.morning.rollcall.date === DEMO_DATE ? DEMO_DATE : jstDate(now);
  if (s.morning.rollcall.date !== today || s.morning.rollcall.status === "closed") {
    await archiveIfReal(s, today);
    s = requestDay({ date: today, viewerId: s.morning.viewerId });
  }
  const at = now.toISOString();
  const rc = s.morning.rollcall;
  // 雪の朝の点呼の最中（作戦の前）: 点呼の答えとして受け付け、作戦で人を決める
  if (rc.status === "announced" || rc.status === "open") {
    putAnswer(s, p.id, "no", at);
    s.log.push(`拠点${base.number}: 「雪かきを頼む」を点呼の答えとして受け付け`);
    await saveMorning(s);
    return MSG.askQueued();
  }
  const prev = s.morning.missions.filter((m) => m.baseId === base.id);
  if (prev.some((m) => m.status !== "done") || s.asked?.[base.id] || prev.length >= MAX_ROUNDS) return MSG.askAlready(base.number);

  const level = p.level ?? 2;
  const round = prev.length + 1;
  const m: Mission = {
    id: round === 1 ? `m-${base.id}` : `m-${base.id}-r${round}`,
    rollcallId: rc.id,
    baseId: base.id,
    importance: importance(level, "no"),
    requiredPeople: requiredPeople(level, "no"),
    subtasks: decompose(p.clearArea ?? "entrance", level),
    status: "short",
    startAt: at,
    reason: "お願いがありました",
    round,
    ask: true,
  };
  s.morning.missions.push(m);
  putAnswer(s, p.id, "no", at);
  s.asked = { ...s.asked, [base.id]: at };

  // 300m 以内の手伝える人へ（1人1日3回まで・1回で5人まで）
  const targets = pickAskTargets(s, roster, m, ASK_DAILY_CAP, ASK_MAX_RECIPIENTS);
  const tasks = m.subtasks.filter((t) => t.minutes === 10).map((t) => `${t.label}（10分）`);
  let sent = 0;
  for (const t of targets) {
    if (!t.lineUserId) continue;
    if (await push(t.lineUserId, MSG.helpRequest(m.id, base.number, missingPeople(s, m), tasks.length ? tasks : ["偵察（10分）"]))) {
      sent++;
      s.askSends = { ...s.askSends, [t.id]: (s.askSends?.[t.id] ?? 0) + 1 };
    }
  }
  setHelpState(s, m.id, { stage: 1, lastAt: at, notifiedIds: targets.map((t) => t.id) });
  s.log.push(`拠点${base.number}: 「雪かきを頼む」で雪かき待ちに（近くの ${sent}人に LINE）`);
  await saveMorning(s);
  return MSG.askOpened(base.number, sent);
}

/** いま、この人に手伝える家があるか（「出動する」を行き止まりにしないため。spec v1.10） */
export async function helpOpenFor(participantId: string, minutes: NowMinutes = 60, now = new Date()): Promise<boolean> {
  if (isNight(now)) return true; // 夜は offerTaskNow が夜の案内を返す
  const s = await loadMorning();
  if (s.morning.rollcall.status !== "planned") return false;
  const roster = await loadRoster();
  const p = roster.participants.find((x) => x.id === participantId);
  if (!p || !(p.role === "helper" || onTeam(p))) return true; // チームのないお願いする側の案内は offerTaskNow のまま
  return pickTaskNow(s, roster, p, minutes) !== null;
}

export async function offerTaskNow(participantId: string, minutes: NowMinutes, now = new Date()): Promise<LineMessage[]> {
  if (isNight(now)) return MSG.nightOwnHouseOnly();
  const s = await loadMorning();
  const roster = await loadRoster();
  const p = roster.participants.find((x) => x.id === participantId);
  if (p?.role === "requester" && !onTeam(p)) return MSG.nowForRequester();
  if (!p || !(p.role === "helper" || onTeam(p))) return MSG.nowNothing();
  if (s.morning.rollcall.status !== "planned") return MSG.nowNothing();
  const offer = pickTaskNow(s, roster, p, minutes);
  if (!offer) return MSG.nowNothing();
  const number = baseNumberOf(roster, offer.mission.baseId);
  s.log.push(`${p.nickname}さんに「いまからやる」: 拠点${number} ${offer.label}（${offer.minutes}分）`);
  await saveMorning(s);
  return MSG.nowOffer(offer.mission.id, number, offer.label, offer.minutes, offer.distanceM);
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

// ---- 1日に何回でも（spec v1.8）: お昼と夕方の出番 ----

/** 終わってから これだけ積もったら、もう一度開く（cm） */
export const REOPEN_SNOW_CM = 3;

/**
 * 降り続いていれば、終わった家をもう一度「雪かき待ち」に（2回目・3回目）。
 * force: /admin のデモ用（天気を見ずに開く）。開いた家の数を返す
 */
export async function reopenIfStillSnowing(now = new Date(), opts: { force?: boolean } = {}): Promise<number> {
  const s = await loadMorning();
  if (s.morning.rollcall.status !== "planned") return 0;
  let since: ((doneAt: string) => boolean) | undefined;
  if (opts.force) since = () => true;
  else {
    if (s.morning.rollcall.date !== jstDate(now)) return 0;
    const hourly = await fetchHourlySnow(TOWN.center);
    const nowKey = jstHourMinute(now);
    since = (doneAt) => sumSnowfall(hourly, jstHourMinute(new Date(doneAt)).slice(0, 13) + ":00", nowKey) >= REOPEN_SNOW_CM;
  }
  const added = reopenDone(s.morning, now.toISOString(), since);
  if (added.length === 0) return 0;
  const roster = await loadRoster();
  s.log.push(`${clockTextJst(now)} 降り続いているので、終わった家をもう一度: ${added.map((m) => `拠点${baseNumberOf(roster, m.baseId)}（${m.round}回目）`).join("・")}`);
  await saveMorning(s);
  return added.length;
}

/**
 * お昼（11:30）・夕方（16:30）の出番: 降り続いていれば終わった家を開き直し、
 * 点呼で「お昼」「夕方」と答えた人に、まだ待っている家の数といま雪かき中の人数を送る。
 */
export async function laterShift(when: "noon" | "pm", now = new Date()): Promise<{ reopened: number; sent: number }> {
  const reopened = await reopenIfStillSnowing(now).catch(async (e) => {
    await recordProblem("laterShift/reopen", e);
    return 0;
  });
  const s = await loadMorning();
  if (s.morning.rollcall.status !== "planned" || isNight(now)) return { reopened, sent: 0 };
  const houses = s.morning.missions.filter((m) => m.status !== "done" && m.status !== "no_answer").length;
  if (houses === 0) return { reopened, sent: 0 };
  const roster = await loadRoster();
  const busy = new Set(s.morning.sorties.filter((x) => x.status === "going").map((x) => x.participantId));
  const ids = s.answers.filter((a) => a.when === when && !busy.has(a.participantId)).map((a) => a.participantId);
  const to = lineIds(roster.participants.filter((p) => ids.includes(p.id)));
  if (to.length === 0) return { reopened, sent: 0 };
  const ok = await multicast(to, MSG.laterNudge(when, houses, activeHelpers(s.morning)));
  s.log.push(`${when === "noon" ? "お昼" : "夕方"}の出番を LINE で ${ok ? to.length : 0} 人に（待っている家 ${houses} 軒）`);
  await saveMorning(s);
  return { reopened, sent: ok ? to.length : 0 };
}
