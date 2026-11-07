// 朝の流れ（予告 → 点呼 → 回答 → 司令官 → 出撃 → 完了）を「今朝の状態」に書き込む。
// 保存先や LINE に関係なく使えるよう、状態と名簿を受け取って書き換えるだけの関数にしている。
import type { CommanderInput, Plan } from "../claude/commander";
import { decompose } from "../game/mission";
import { scoreMission } from "../game/score";
import { clockText, jstIso } from "../jst";
import type { HelperAnswer, HelpStyle, Mission, Participant, RequesterAnswer, RollcallAnswer, Sortie, TeamId } from "../types";
import type { CheerRecord } from "./cheer";
import type { CaptainState } from "../captain";
import type { Roster } from "./roster";
import { progress, type MorningState } from "./view";

export { clockText };

/** 今朝の状態。DB では morning_state 表に JSON で1行 */
export interface MorningRecord {
  morning: MorningState;
  answers: RollcallAnswer[];
  /** 司令官が書いた、割り当てられた人それぞれへの文面 */
  messages: Plan["messages"];
  /** 前夜の予告や、エリアのみんなへのまとめ */
  briefing: string;
  /** デモの時計（分、0時から）。完了のたびに進む */
  clockMin: number;
  log: string[];
  /** ヘルプ通知の進み具合（ミッション ID ごと）。古い記録にはない */
  help?: Record<string, HelpState>;
  /** 日曜の「今週の群れ」のまとめ（/admin に出す） */
  weekly?: {
    weekStart: string;
    commentary: string;
    nextWeek: string;
    ranking: TeamId[];
    teamTotals: Record<TeamId, number>;
    titles: { participantId: string; nickname: string; title: string; rareCard: boolean }[];
    at: string;
  };
  /** 今朝の実況（Claude、v1.1）。全軒完了で自動、/admin のボタンでも */
  recap?: { text: string; at: string; allDone: boolean };
  /** ありがとう点呼（v1.1）: ミッション ID ごとに、お願いした人の3択と、Claude が整えた一文 */
  thanks?: Record<string, ThanksRecord>;
  /** 声のありがとう（v1.29）: ミッション ID ごと。音そのものは lib/thanks/voice.ts */
  thanksVoice?: Record<string, { at: string; seconds: number; sentTo: number }>;
  /** 今朝が初出撃だった人（最初のカードを受け取った人、v1.1） */
  firstFlights?: string[];
  /** 家族の応援スタンプ（v1.2）: ミッション ID ごと（家族が複数いれば複数） */
  cheers?: Record<string, CheerRecord[]>;
  /** 隊長のひとこと（状態ごと、spec v1.6）。点呼の時に1回だけ書いて、みんなで使い回す */
  captainLines?: Partial<Record<CaptainState, string>>;
  /** 今朝の先生のコツ（作戦の時に選ぶ、spec v1.6） */
  teacherTip?: { line: string };
  /** コツを送ってくれるのを待っている人（「教える」を押した人） */
  awaitingTip?: string[];
  /** あなたが主役の招待文（spec v1.6）: 完了した人ごとに3案 */
  invites?: Record<string, string[]>;
  /** いま自分の家の雪かきをしている人（参加者 ID → 始めた時刻 ISO）。lib/solo/home-now.ts */
  homeNow?: Record<string, string>;
  /** 自宅の雪かきへの応援・おつかれさま（その日だけ）。lib/solo/home-cheer.ts */
  homeCheers?: import("../solo/home-cheer").HomeCheers;
  /** 「雪かきを頼む」（spec v1.10）: 頼んだ家（拠点 ID → 時刻 ISO）と、知らせを受けた人の回数（参加者 ID → 回数）。その日だけ */
  asked?: Record<string, string>;
  askSends?: Record<string, number>;
  /** チームで時間をそろえる（spec v1.41）: 選んだ帯（その日だけ）と、チームごとの隊長のことば */
  timeWishes?: import("../calendar/slots").TimeWish[];
  slotLines?: import("../calendar/slots").SlotLines;
}

export interface ThanksRecord {
  choice: "1" | "2" | "3";
  label: string; // ありがとう／助かりました／お茶どうぞ
  sentence: string; // カード裏面の一文
  at: string; // ISO
  /** 伝えた相手（手伝った人）の数 */
  sentTo: number;
}

/** ヘルプ通知の輪: 0=まだ / 1=300m / 2=600m / 3=1km / 4=サポーターまで出した */
export interface HelpState {
  stage: 0 | 1 | 2 | 3 | 4;
  lastAt?: string; // ISO
  notifiedIds: string[];
  /** 声かけ（返事なし）をお願いした人 */
  knockIds?: string[];
}

/** デモ用の日付（12月の月曜の朝）。本番の cron は本当の日付で動かす */
export const DEMO_DATE = "2026-12-14";

let idSeq = 0;
const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(idSeq++).toString(36)}`;

const iso = (s: MorningRecord, min: number) => jstIso(s.morning.rollcall.date, min);

/** 前夜の予告だけが出ている、まっさらな朝 */
export function emptyMorning(
  opts: { date?: string; forecastCm?: number; viewerId?: string; announcement?: string; snowName?: string; tempMinC?: number; windMaxMs?: number; depthCm?: number } = {},
): MorningRecord {
  const date = opts.date ?? DEMO_DATE;
  const forecastCm = opts.forecastCm ?? 12;
  return {
    morning: {
      rollcall: { id: `rc-${date}`, date, forecastCm, status: "announced", snowName: opts.snowName, ...(opts.tempMinC !== undefined ? { tempMinC: opts.tempMinC } : {}), ...(opts.windMaxMs !== undefined ? { windMaxMs: opts.windMaxMs } : {}), ...(opts.depthCm !== undefined ? { depthCm: opts.depthCm } : {}) },
      missions: [],
      sorties: [],
      scores: [],
      viewerId: opts.viewerId ?? "h7",
    },
    answers: [],
    messages: [],
    briefing: opts.announcement ?? `明朝 6:30 に点呼します。予想 ${forecastCm}cm。長靴と手袋を。`,
    clockMin: 6 * 60 + 25,
    log: ["前夜 21:00 予告を送りました"],
  };
}

/** 雪の朝でない日に「雪かきを頼む」が押されたときの、その日の記録（作戦のあとと同じ形にして、出動・地図・完了の流れをそのまま使う） */
export function requestDay(opts: { date: string; viewerId?: string }): MorningRecord {
  const s = emptyMorning({ date: opts.date, forecastCm: 0, viewerId: opts.viewerId, announcement: "今日は雪かきのお願いがあります。" });
  s.morning.rollcall.status = "planned";
  s.log = ["「雪かきを頼む」で今日の記録を始めました"];
  return s;
}

export function ringRollcall(s: MorningRecord): void {
  s.morning.rollcall.status = "open";
  s.clockMin = 6 * 60 + 30;
  s.log.push("6:30 雪かき応援のお知らせを始めました");
}

/**
 * 家族が代理登録した LINE のない家（本人の LINE がまだ紐づいていない）。
 * 点呼は届かないので、毎回「一緒になら雪かきできる」として扱い（返事なしの見守りにしない）、
 * 手伝う人が最初に声かけ（見守り）をしながら一緒に雪かきをする。
 */
export function isProxyHome(p: Participant): boolean {
  return p.role === "requester" && !p.lineUserId && Boolean(p.registeredByFamilyId);
}

/** 手伝う人に見せる「一緒にやる家」のひとこと（20字まで） */
export const TOGETHER_NOTE = "家の人も一緒に雪かきします";

/** その家の頼み方（spec v1.20）。登録がない前の版の家は、代理の家は一緒に・本人の家はおまかせ */
export function styleOf(p: Participant): HelpStyle {
  return p.helpStyle ?? (isProxyHome(p) ? "together" : "omakase");
}

/**
 * 10cm 以上積もった朝（spec v1.20）: 頼む家として登録した家を、毎朝の質問なしで「雪かき待ち」にする。
 * おまかせ → 来てほしい（no）、一緒に → 一緒なら（together、必要な人数が1人へる）。もう答え・お願いがある家はそのまま
 */
export function autoAnswerHomes(s: MorningRecord, roster: Roster, answeredAt: string): number {
  let n = 0;
  for (const p of roster.participants) {
    if (p.role !== "requester" || !roster.bases.some((b) => b.requesterId === p.id)) continue;
    if (s.answers.some((a) => a.participantId === p.id)) continue;
    const together = styleOf(p) === "together";
    putAnswer(s, p.id, together ? "together" : "no", answeredAt);
    if (together) s.answers[s.answers.length - 1].request = { note: TOGETHER_NOTE };
    n++;
  }
  return n;
}

/** 点呼の答えを入れる（同じ人の前の答えは置き換える） */
export function putAnswer(
  s: MorningRecord,
  participantId: string,
  answer: RollcallAnswer["answer"],
  answeredAt: string,
  when?: RollcallAnswer["when"],
): void {
  s.answers = s.answers.filter((a) => a.participantId !== participantId);
  s.answers.push({ rollcallId: s.morning.rollcall.id, participantId, answer, answeredAt, ...(when ? { when } : {}) });
}

/**
 * 決まった種の乱数で、LINE のない人（架空の住民）の点呼の答えを入れる（返事しない人も少しいる）。
 * LINE で登録した本物の人の答えはそのまま残す。
 */
export function fillAnswers(s: MorningRecord, roster: Roster, seed = 7): void {
  let x = seed >>> 0;
  const rand = () => ((x = (Math.imul(x ^ (x >>> 15), 2246822507) + 3266489909) >>> 0) / 2 ** 32);
  for (const p of roster.participants) {
    if (p.lineUserId || isProxyHome(p)) continue;
    const r = rand();
    if (p.role === "requester") {
      if (r < 0.12) {
        s.answers = s.answers.filter((a) => a.participantId !== p.id); // 返事なし
        continue;
      }
      const answer: RequesterAnswer = r < 0.62 ? "no" : r < 0.85 ? "together" : "yes";
      putAnswer(s, p.id, answer, iso(s, 6 * 60 + 32));
    } else {
      const answer: HelperAnswer = r < 0.15 ? 0 : r < 0.55 ? 20 : r < 0.85 ? 30 : 60;
      putAnswer(s, p.id, answer, iso(s, 6 * 60 + 33));
    }
  }
  s.clockMin = Math.max(s.clockMin, 6 * 60 + 38);
  s.log.push(`点呼の回答 ${s.answers.length} 件（${roster.participants.length} 人中）`);
}

/** 司令官に渡す材料を作る */
export function commanderInput(s: MorningRecord, roster: Roster): CommanderInput {
  const answerOf = (id: string) => s.answers.find((a) => a.participantId === id)?.answer;
  // 6:40 の作戦に入れるのは朝に動ける人だけ（v1.8）。お昼・夕方の人は、その時間に開いている家をお知らせする
  const laterOf = (id: string) => {
    const w = s.answers.find((a) => a.participantId === id)?.when;
    return w === "noon" || w === "pm";
  };
  const byId = new Map(roster.participants.map((p) => [p.id, p]));
  return {
    date: s.morning.rollcall.date,
    forecastCm: s.morning.rollcall.forecastCm,
    startTime: "07:00",
    bases: roster.bases.flatMap((b) => {
      const r = byId.get(b.requesterId);
      if (!r) return [];
      return [
        {
          baseId: b.id,
          number: b.number,
          level: r.level ?? 2,
          answer: (answerOf(r.id) as RequesterAnswer | undefined) ?? "none",
          location: r.location,
          requesterName: r.nickname,
        },
      ];
    }),
    helpers: roster.participants
      .filter((p) => p.role === "helper" && p.teamId)
      .map((h) => ({
        id: h.id,
        nickname: h.nickname,
        teamId: h.teamId!,
        minutes: laterOf(h.id) ? 0 : ((answerOf(h.id) as HelperAnswer | undefined) ?? 0),
        location: h.location,
      })),
  };
}

/** 司令官の作戦をミッションと出撃に変える */
export function applyPlan(s: MorningRecord, roster: Roster, plan: Plan): void {
  const rc = s.morning.rollcall;
  const byId = new Map(roster.participants.map((p) => [p.id, p]));
  const missions: Mission[] = [];
  for (const m of plan.missions) {
    const base = roster.bases.find((b) => b.id === m.baseId);
    const r = base && byId.get(base.requesterId);
    if (!base || !r) continue;
    missions.push({
      id: `m-${m.baseId}`,
      rollcallId: rc.id,
      baseId: m.baseId,
      importance: m.importance,
      requiredPeople: m.requiredPeople,
      subtasks: [
        ...(isProxyHome(r) ? [{ id: "check", kind: "scout" as const, label: "声かけ（ごあいさつ・見守り）", minutes: 10 as const }] : []),
        ...decompose(r.clearArea ?? "entrance", r.level ?? 2),
      ],
      status: m.status,
      startAt: iso(s, 7 * 60),
      reason: m.reason,
      ...(s.answers.find((a) => a.participantId === r.id)?.request ? { request: s.answers.find((a) => a.participantId === r.id)!.request } : {}),
    });
  }
  s.morning.missions = missions;
  s.morning.sorties = plan.missions.flatMap((m) =>
    m.assignedHelperIds.flatMap((hid): Sortie[] => {
      const h = byId.get(hid);
      if (!h?.teamId || !missions.some((x) => x.baseId === m.baseId)) return [];
      return [
        {
          id: newId("s"),
          missionId: `m-${m.baseId}`,
          participantId: hid,
          teamId: h.teamId,
          subtaskIds: [],
          status: "going",
          rescue: false,
        },
      ];
    }),
  );
  s.morning.scores = [];
  s.messages = plan.messages;
  s.briefing = plan.briefing;
  rc.status = "planned";
  s.clockMin = Math.max(s.clockMin, 6 * 60 + 40);
  s.log.push(`6:40 作戦を配信（${missions.length} 軒・${plan.messages.length} 人）`);
}

/** 人がそろっている家を1軒、完了にする（時計を6分進める） */
export function completeNext(s: MorningRecord, roster: Roster, skip?: (missionId: string) => boolean): string | null {
  const open = s.morning.missions.filter((x) => x.status === "assigned" || x.status === "in_progress").sort((a, b) => b.importance - a.importance);
  // skip: デモで先に終わらせたくない家（本物の人が写真で終える家）。ほかに家がなければ、それも終わらせる
  const m = open.find((x) => !skip?.(x.id)) ?? open[0];
  if (!m) return null;
  s.clockMin = Math.max(s.clockMin, 7 * 60) + 6;
  const at = iso(s, s.clockMin);
  const sorties = s.morning.sorties.filter((x) => x.missionId === m.id);
  for (const so of sorties) {
    so.status = "done";
    so.completedAt = at;
  }
  m.status = "done";
  s.morning.scores.push(...scoreMission(sorties, at, false, s.morning.rollcall.forecastCm));
  const number = roster.bases.find((b) => b.id === m.baseId)?.number ?? "?";
  s.log.push(`${clockText(s.clockMin)} 拠点${number} 完了（${sorties.length}人）`);
  if (progress(s.morning).allDone) s.log.push(`${clockText(s.clockMin)} 「${s.morning.rollcall.snowName ?? "今朝の雪"}」討伐（全軒完了）`);
  return m.id;
}

/**
 * 人手不足の家に、手の空いた人（割り当てなし、または自分の家を終えた人）が駆けつける（/admin のデモ操作）。そろったら作業中にする。
 * - 家: もう誰かが向かっている人手不足の家を先に（「行く」を押した人のところへ合流する）
 * - 人: 架空の人だけ（本物の人＝LINE でログインした人を勝手に動かさない）。「行けない（0分）」と答えた人は除く。
 *   v1.20 から手伝う側には朝の質問がないので、答えていない人も動ける。その家にまだいないチームの人を先に（2チームの合流）、
 *   次に自分の家を終えた人（駆けつけボーナス）
 */
export function rescueShort(s: MorningRecord, roster: Roster, targetId?: string, exclude?: ReadonlySet<string>): string | null {
  const going = s.morning.sorties.filter((x) => x.status === "going");
  const shorts = s.morning.missions.filter((x) => x.status === "short" && (!targetId || x.id === targetId));
  const m = shorts.find((x) => going.some((g) => g.missionId === x.id)) ?? shorts[0];
  if (!m) return null;
  const busy = new Set(going.map((x) => x.participantId));
  const canMove = (id: string) => s.answers.find((a) => a.participantId === id)?.answer !== 0;
  const teamsThere = new Set(s.morning.sorties.filter((x) => x.missionId === m.id).map((x) => x.teamId));
  const finished = (id: string) => s.morning.sorties.some((x) => x.participantId === id && x.status === "done");
  const candidates = roster.participants.filter((p) => p.role === "helper" && p.teamId && !p.lineUserId && !exclude?.has(p.id) && !busy.has(p.id) && canMove(p.id));
  const rank = (p: (typeof candidates)[number]) => (teamsThere.has(p.teamId!) ? 0 : 2) + (finished(p.id) ? 1 : 0);
  const helper = candidates.reduce<(typeof candidates)[number] | undefined>((best, p) => (!best || rank(p) > rank(best) ? p : best), undefined);
  if (!helper) return null;
  const finishedOwn = s.morning.sorties.some((x) => x.participantId === helper.id && x.status === "done");
  s.morning.sorties.push({
    id: newId("s"),
    missionId: m.id,
    participantId: helper.id,
    teamId: helper.teamId!,
    subtaskIds: [],
    status: "going",
    rescue: finishedOwn, // 駆けつけボーナスは自分の割り当てを終えた人だけ
  });
  const people = s.morning.sorties.filter((x) => x.missionId === m.id).length;
  if (people >= m.requiredPeople) m.status = "in_progress";
  const number = roster.bases.find((b) => b.id === m.baseId)?.number ?? "?";
  s.log.push(`${clockText(s.clockMin)} ${helper.nickname}さんが拠点${number}に駆けつけ`);
  return helper.id;
}

/**
 * /admin の「1軒、完了にする」（デモ）: v1.20 は手伝う側に朝の質問がないので、作戦のあとも人手不足の家ばかりになる。
 * 終わらせる家がなければ、人手不足の家（skip の家を除く・大事な順）に架空の人を駆けつけさせてそろえてから、1軒終わらせる。
 */
export function completeNextForDemo(s: MorningRecord, roster: Roster, skip?: (missionId: string) => boolean, exclude?: ReadonlySet<string>): string | null {
  const open = () => s.morning.missions.some((x) => (x.status === "assigned" || x.status === "in_progress") && !skip?.(x.id));
  if (!open()) {
    const target = s.morning.missions.filter((x) => x.status === "short" && !skip?.(x.id)).sort((a, b) => b.importance - a.importance)[0];
    for (let i = 0; target && i < 10 && target.status === "short"; i++) if (!rescueShort(s, roster, target.id, exclude)) break;
  }
  return completeNext(s, roster, skip);
}
