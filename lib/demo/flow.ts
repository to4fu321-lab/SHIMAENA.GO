// デモの朝の流れ（点呼 → 回答 → 司令官 → 出撃 → 完了）。
// 保存先に関係なく使えるよう、状態を受け取って書き換えるだけの関数にしている。
import type { CommanderInput, Plan } from "../claude/commander";
import { decompose } from "../game/mission";
import { scoreMission } from "../game/score";
import type { MorningState } from "../morning";
import { TOWN } from "../town";
import type { HelperAnswer, Mission, RequesterAnswer, RollcallAnswer, Sortie } from "../types";

export interface DemoState {
  morning: MorningState;
  answers: RollcallAnswer[];
  messages: Plan["messages"];
  briefing: string;
  /** デモの時計（分、0時から）。完了のたびに進む */
  clockMin: number;
  log: string[];
}

const DATE = "2026-12-14";
const pad = (n: number) => String(n).padStart(2, "0");
export const clockText = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
const iso = (min: number) => `${DATE}T${clockText(min)}:00+09:00`;

let idSeq = 0;
const newId = (prefix: string) => `${prefix}${Date.now().toString(36)}${(idSeq++).toString(36)}`;

/** 前夜の予告だけが出ている、まっさらな朝 */
export function emptyMorning(viewerId = "h7"): DemoState {
  return {
    morning: {
      rollcall: { id: `rc-${DATE}`, date: DATE, forecastCm: 12, status: "announced" },
      missions: [],
      sorties: [],
      scores: [],
      viewerId,
    },
    answers: [],
    messages: [],
    briefing: "明朝 6:30 に点呼します。予想 12cm。長靴と手袋を。",
    clockMin: 6 * 60 + 25,
    log: ["前夜 21:00 予告を送りました"],
  };
}

export function ringRollcall(s: DemoState): void {
  s.morning.rollcall.status = "open";
  s.clockMin = 6 * 60 + 30;
  s.log.push("6:30 エナガ点呼を送りました");
}

/** 決まった種の乱数で、全員の点呼の答えを入れる（返事しない人も少しいる） */
export function fillAnswers(s: DemoState, seed = 7): void {
  let x = seed >>> 0;
  const rand = () => ((x = (Math.imul(x ^ (x >>> 15), 2246822507) + 3266489909) >>> 0) / 2 ** 32);
  s.answers = [];
  for (const p of TOWN.participants) {
    const r = rand();
    if (p.role === "requester") {
      if (r < 0.12) continue; // 返事なし
      const answer: RequesterAnswer = r < 0.62 ? "no" : r < 0.85 ? "together" : "yes";
      s.answers.push({ rollcallId: s.morning.rollcall.id, participantId: p.id, answer, answeredAt: iso(6 * 60 + 32) });
    } else {
      const answer: HelperAnswer = r < 0.15 ? 0 : r < 0.55 ? 15 : r < 0.85 ? 30 : 60;
      s.answers.push({ rollcallId: s.morning.rollcall.id, participantId: p.id, answer, answeredAt: iso(6 * 60 + 33) });
    }
  }
  s.clockMin = 6 * 60 + 38;
  s.log.push(`点呼の回答 ${s.answers.length} 件（${TOWN.participants.length} 人中）`);
}

/** 司令官に渡す材料を作る */
export function commanderInput(s: DemoState): CommanderInput {
  const answerOf = (id: string) => s.answers.find((a) => a.participantId === id)?.answer;
  return {
    date: DATE,
    forecastCm: s.morning.rollcall.forecastCm,
    startTime: "07:00",
    bases: TOWN.bases.map((b) => {
      const r = TOWN.participants.find((p) => p.id === b.requesterId)!;
      return {
        baseId: b.id,
        number: b.number,
        level: r.level ?? 2,
        answer: (answerOf(r.id) as RequesterAnswer | undefined) ?? "none",
        location: r.location,
        requesterName: r.nickname,
      };
    }),
    helpers: TOWN.participants
      .filter((p) => p.role === "helper")
      .map((h) => ({
        id: h.id,
        nickname: h.nickname,
        teamId: h.teamId!,
        minutes: (answerOf(h.id) as HelperAnswer | undefined) ?? 0,
        location: h.location,
      })),
  };
}

/** 司令官の作戦をミッションと出撃に変える */
export function applyPlan(s: DemoState, plan: Plan): void {
  const rc = s.morning.rollcall;
  s.morning.missions = plan.missions.map((m) => {
    const base = TOWN.bases.find((b) => b.id === m.baseId)!;
    const r = TOWN.participants.find((p) => p.id === base.requesterId)!;
    const mission: Mission = {
      id: `m-${m.baseId}`,
      rollcallId: rc.id,
      baseId: m.baseId,
      importance: m.importance,
      requiredPeople: m.requiredPeople,
      subtasks: decompose(r.clearArea ?? "entrance", r.level ?? 2),
      status: m.status,
      startAt: iso(7 * 60),
    };
    return mission;
  });
  s.morning.sorties = plan.missions.flatMap((m) =>
    m.assignedHelperIds.map((hid): Sortie => {
      const h = TOWN.participants.find((p) => p.id === hid)!;
      return {
        id: newId("s"),
        missionId: `m-${m.baseId}`,
        participantId: hid,
        teamId: h.teamId!,
        subtaskIds: [],
        status: "going",
        rescue: false,
      };
    }),
  );
  s.morning.scores = [];
  s.messages = plan.messages;
  s.briefing = plan.briefing;
  rc.status = "planned";
  s.clockMin = 6 * 60 + 40;
  s.log.push(`6:40 作戦を配信（${plan.missions.length} 軒・${plan.messages.length} 人）`);
}

/** 人がそろっている家を1軒、完了にする（時計を6分進める） */
export function completeNext(s: DemoState): string | null {
  const m = s.morning.missions
    .filter((x) => x.status === "assigned" || x.status === "in_progress")
    .sort((a, b) => b.importance - a.importance)[0];
  if (!m) return null;
  s.clockMin = Math.max(s.clockMin, 7 * 60) + 6;
  const at = iso(s.clockMin);
  const sorties = s.morning.sorties.filter((x) => x.missionId === m.id);
  for (const so of sorties) {
    so.status = "done";
    so.completedAt = at;
  }
  m.status = "done";
  s.morning.scores.push(...scoreMission(sorties, at, false));
  const base = TOWN.bases.find((b) => b.id === m.baseId)!;
  s.log.push(`${clockText(s.clockMin)} 拠点${base.number} 完了（${sorties.length}人）`);
  return m.id;
}

/**
 * 人手不足の家に、手の空いた人（割り当てなし、または自分の家を終えた人）が駆けつける。
 * そろったら作業中にする。
 */
export function rescueShort(s: DemoState): string | null {
  const m = s.morning.missions.find((x) => x.status === "short");
  if (!m) return null;
  const busy = new Set(s.morning.sorties.filter((x) => x.status === "going").map((x) => x.participantId));
  const canMove = (id: string) => (s.answers.find((a) => a.participantId === id)?.answer ?? 0) !== 0;
  const helper = TOWN.participants.find((p) => p.role === "helper" && !busy.has(p.id) && canMove(p.id));
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
  const going = s.morning.sorties.filter((x) => x.missionId === m.id).length;
  if (going >= m.requiredPeople) m.status = "in_progress";
  const base = TOWN.bases.find((b) => b.id === m.baseId)!;
  s.log.push(`${clockText(s.clockMin)} ${helper.nickname}さんが拠点${base.number}に駆けつけ`);
  return helper.id;
}
