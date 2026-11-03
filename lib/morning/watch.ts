// ヘルプ通知と見守り（spec 4）の「判断」の部分。保存や LINE はしない純粋な関数。
import { distanceM, helpTargets, HELP_RADII } from "../game/help";
import { SUPPORT_TASKS, requiredPeople } from "../game/mission";
import type { HelperAnswer, Mission, Participant, RequesterAnswer } from "../types";
import type { HelpState, MorningRecord } from "./flow";
import type { Roster } from "./roster";

/** 同じ家に次の輪を出すまでの間隔（分） */
export const HELP_RING_MINUTES = 5;

export const RING_LABEL = ["300m", "600m", "1km", "サポーター"] as const;

export function helpState(s: MorningRecord, missionId: string): HelpState {
  return s.help?.[missionId] ?? { stage: 0, notifiedIds: [] };
}

export function setHelpState(s: MorningRecord, missionId: string, state: HelpState): void {
  s.help ??= {};
  s.help[missionId] = state;
}

export function goingCount(s: MorningRecord, missionId: string): number {
  return s.morning.sorties.filter((x) => x.missionId === missionId && x.status !== "done").length;
}

/** あと何人要るか。現場が「人手が足りない」と言っている家は、人数が足りて見えても 1 人は呼ぶ */
export function missingPeople(s: MorningRecord, m: Mission): number {
  const diff = m.requiredPeople - goingCount(s, m.id);
  if (diff > 0) return diff;
  return m.status === "short" ? 1 : 0;
}

/** 今どこかの家に向かっている人（自分の家を終えた人は含まない＝駆けつけ候補） */
export function busyIds(s: MorningRecord): Set<string> {
  return new Set(s.morning.sorties.filter((x) => x.status === "going").map((x) => x.participantId));
}

/**
 * その輪（0=〜300m, 1=300〜600m, 2=600m〜1km）で呼ぶ人: 手伝う側、半径内、向かっていない、まだ呼んでいない。
 * 点呼で 0 分と答えた人には送らない。
 */
export function pickHelpTargets(s: MorningRecord, roster: Roster, m: Mission, ring: 0 | 1 | 2): Participant[] {
  const base = roster.bases.find((b) => b.id === m.baseId);
  const requester = base && roster.participants.find((p) => p.id === base.requesterId);
  if (!requester) return [];
  const exclude = new Set([...busyIds(s), ...helpState(s, m.id).notifiedIds]);
  const zero = new Set(s.answers.filter((a) => a.answer === 0).map((a) => a.participantId));
  return helpTargets(requester.location, roster.participants, ring, exclude).filter((h) => !zero.has(h.id));
}

/** 返事なしの家の「声かけ」をお願いする人: 300m 以内の手伝う側（向かっている人は除く） */
export function pickKnockTargets(s: MorningRecord, roster: Roster, m: Mission): Participant[] {
  const base = roster.bases.find((b) => b.id === m.baseId);
  const requester = base && roster.participants.find((p) => p.id === base.requesterId);
  if (!requester) return [];
  return helpTargets(requester.location, roster.participants, 0, busyIds(s));
}

/** 画面に出す「人手が足りない家」（spec v1.1: あと1人で救える家） */
export interface ShortHouse {
  missionId: string;
  baseNumber: number | string;
  missing: number;
  required: number;
  going: number;
  /** 5分でできる仕事（最大2つ） */
  tasks: string[];
  importance: number;
}

/** 人手が足りない家を、あと少しで救える順（足りない人数が少ない順 → 重要度の高い順）に */
export function listShort(s: MorningRecord, roster: Roster): ShortHouse[] {
  return s.morning.missions
    .filter((m) => m.status === "short")
    .map((m) => {
      const five = m.subtasks.filter((t) => t.minutes === 5).map((t) => t.label);
      return {
        missionId: m.id,
        baseNumber: roster.bases.find((b) => b.id === m.baseId)?.number ?? "?",
        missing: missingPeople(s, m),
        required: m.requiredPeople,
        going: goingCount(s, m.id),
        tasks: (five.length > 0 ? five : [SUPPORT_TASKS[0].label]).slice(0, 2),
        importance: m.importance,
      };
    })
    .sort((a, b) => a.missing - b.missing || b.importance - a.importance);
}

export interface TaskOffer {
  mission: Mission;
  label: string;
  minutes: number;
  distanceM: number;
}

/**
 * 「いまからやる（5／15／30分）」: 近くの小タスクを1件選ぶ（spec 2 日中）。
 * 人手不足の家を優先し、なければ作業中の家の偵察・補給（5分）。動ける分数に収まるものだけ。
 */
export function pickTaskNow(s: MorningRecord, roster: Roster, p: Participant, minutes: 5 | 15 | 30): TaskOffer | null {
  if (busyIds(s).has(p.id)) return null; // もうどこかに向かっている
  const candidates: TaskOffer[] = [];
  for (const m of s.morning.missions) {
    if (m.status === "done" || m.status === "no_answer") continue;
    const base = roster.bases.find((b) => b.id === m.baseId);
    const requester = base && roster.participants.find((x) => x.id === base.requesterId);
    if (!requester) continue;
    const d = distanceM(p.location, requester.location);
    if (d > HELP_RADII[2]) continue;
    if (m.status === "short" || m.status === "open") {
      const task = m.subtasks.filter((t) => t.minutes <= minutes).sort((a, b) => b.minutes - a.minutes)[0];
      if (task) candidates.push({ mission: m, label: task.label, minutes: task.minutes, distanceM: d });
    } else {
      const task = SUPPORT_TASKS[0];
      candidates.push({ mission: m, label: task.label, minutes: task.minutes, distanceM: d });
    }
  }
  const rank = (o: TaskOffer) => (o.mission.status === "short" ? 0 : o.mission.status === "open" ? 1 : 2);
  candidates.sort((a, b) => rank(a) - rank(b) || a.distanceM - b.distanceM);
  return candidates[0] ?? null;
}

export function helpDue(state: HelpState, now: Date): boolean {
  if (state.stage >= 4) return false;
  if (!state.lastAt) return true;
  return now.getTime() - new Date(state.lastAt).getTime() >= HELP_RING_MINUTES * 60_000;
}

export const radiusLabel = (ring: number) => (ring < HELP_RADII.length ? RING_LABEL[ring] : RING_LABEL[3]);

export type LateAnswerResult =
  | { kind: "no_mission" }
  | { kind: "fine"; mission: Mission } // 遅れて「はい」→ その家はもう大丈夫
  | { kind: "short"; mission: Mission } // 遅れて「いいえ／一緒なら」→ 人手が要る
  | { kind: "helper" }; // 手伝う側の遅い答え → 記録だけ

/** 作戦配信のあとに届いた点呼の答え（spec 4-c）を今朝の状態に反映する */
export function applyLateAnswer(
  s: MorningRecord,
  roster: Roster,
  p: Participant,
  answer: RequesterAnswer | HelperAnswer,
  answeredAt: string,
): LateAnswerResult {
  s.answers = s.answers.filter((a) => a.participantId !== p.id);
  s.answers.push({ rollcallId: s.morning.rollcall.id, participantId: p.id, answer, answeredAt });
  if (p.role === "helper") return { kind: "helper" };
  const base = roster.bases.find((b) => b.requesterId === p.id);
  const mission = base && s.morning.missions.find((m) => m.baseId === base.id);
  if (!mission || mission.status === "done") return { kind: "no_mission" };
  if (answer === "yes") {
    // 出られるなら、その家のミッションは取り下げる（向かっていた人は手が空く）
    s.morning.missions = s.morning.missions.filter((m) => m.id !== mission.id);
    s.morning.sorties = s.morning.sorties.filter((x) => x.missionId !== mission.id);
    return { kind: "fine", mission };
  }
  mission.requiredPeople = requiredPeople(p.level ?? 2, answer as RequesterAnswer);
  mission.status = goingCount(s, mission.id) >= mission.requiredPeople ? "assigned" : "short";
  return { kind: "short", mission };
}
