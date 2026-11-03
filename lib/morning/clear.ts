// ミッション完了の「まとめ」（spec v1.1: MISSION CLEAR）。点の内訳・チーム得点・雪HPの減りを1つの形にする。
// 得点そのものは lib/game/score.ts が決める。ここは見せるために集計するだけ（純粋な関数）。
import type { ScoreEvent, ScoreReason, TeamId } from "../types";
import type { Roster } from "./roster";
import { type MorningState, progress, snowHp, teamTotals } from "./view";

export const REASON_LABEL: Record<ScoreReason, string> = {
  mission_done: "完了",
  early: "7:30 までに完了",
  rescue: "駆けつけ",
  flock: "同じチーム2人以上",
  mixed: "2チームが合流",
  scout: "偵察",
  supply: "補給",
  requester_joined: "本人も参加",
  weekly_goal: "週の目標",
};

export interface ClearItem {
  reason: ScoreReason;
  label: string;
  count: number;
  points: number;
}

export interface ClearSummary {
  missionId: string;
  baseNumber: number | string;
  snowName?: string;
  /** 来た人の呼び名 */
  members: string[];
  teamIds: TeamId[];
  /** この家で入った点の内訳（理由ごと） */
  items: ClearItem[];
  /** この家で入った点（全チーム合計） */
  totalPoints: number;
  /** 今朝のチーム合計（加算後） */
  teamTotals: Record<TeamId, number>;
  /** 画面を見ている人が今朝ここまでに入れた点（個人順位は出さない。本人の記録だけ） */
  myPoints?: number;
  hpBefore: number;
  hpAfter: number;
  hpMax: number;
  left: number;
  allDone: boolean;
  defeatedAt?: string;
  completedAt: string;
}

/** 理由ごとにまとめる（出てくる順は得点表の順） */
export function breakdown(events: ScoreEvent[]): ClearItem[] {
  const order = Object.keys(REASON_LABEL) as ScoreReason[];
  const map = new Map<ScoreReason, ClearItem>();
  for (const e of events) {
    const cur = map.get(e.reason) ?? { reason: e.reason, label: REASON_LABEL[e.reason], count: 0, points: 0 };
    cur.count++;
    cur.points += e.points;
    map.set(e.reason, cur);
  }
  return order.flatMap((r) => (map.has(r) ? [map.get(r)!] : []));
}

/** その家の完了で入った得点（完了時刻が同じで、来た人かそのチームのもの） */
export function eventsForMission(state: MorningState, missionId: string): ScoreEvent[] {
  const sorties = state.sorties.filter((x) => x.missionId === missionId && x.status === "done");
  const at = sorties.find((x) => x.completedAt)?.completedAt;
  if (!at) return [];
  const people = new Set(sorties.map((x) => x.participantId));
  const teams = new Set(sorties.map((x) => x.teamId));
  return state.scores.filter((e) => e.at === at && (e.participantId ? people.has(e.participantId) : teams.has(e.teamId)));
}

export function summarizeClear(
  state: MorningState,
  roster: Roster,
  missionId: string,
  opts: { hpBefore?: number; viewerId?: string } = {},
): ClearSummary | null {
  const mission = state.missions.find((m) => m.id === missionId);
  if (!mission || mission.status !== "done") return null;
  const sorties = state.sorties.filter((x) => x.missionId === missionId && x.status === "done");
  const completedAt = sorties.find((x) => x.completedAt)?.completedAt ?? "";
  const byId = new Map(roster.participants.map((p) => [p.id, p]));
  const members = sorties.map((x) => byId.get(x.participantId)?.nickname ?? "").filter(Boolean);
  const teamIds: TeamId[] = [];
  for (const x of sorties) if (!teamIds.includes(x.teamId)) teamIds.push(x.teamId);
  const events = eventsForMission(state, missionId);
  const items = breakdown(events);
  const hp = snowHp(state);
  const prog = progress(state);
  const myPoints =
    opts.viewerId === undefined
      ? undefined
      : state.scores.filter((e) => e.participantId === opts.viewerId).reduce((a, e) => a + e.points, 0);
  return {
    missionId,
    baseNumber: roster.bases.find((b) => b.id === mission.baseId)?.number ?? "?",
    snowName: state.rollcall.snowName,
    members,
    teamIds,
    items,
    totalPoints: events.reduce((a, e) => a + e.points, 0),
    teamTotals: teamTotals(state),
    myPoints,
    hpBefore: opts.hpBefore ?? Math.min(hp.max, hp.current + state.rollcall.forecastCm),
    hpAfter: hp.current,
    hpMax: hp.max,
    left: prog.left,
    allDone: prog.allDone,
    defeatedAt: prog.defeatedAt,
    completedAt,
  };
}

/**
 * いちばん最近に完了した家のまとめ（他の人の完了に気づくため）。なければ null。
 * 「最近」は時刻ではなく完了した順（得点が記録された順）で決める。デモの時計（12月の朝）と本当の時刻が混ざっても狂わない。
 */
export function latestClear(state: MorningState, roster: Roster, viewerId?: string): ClearSummary | null {
  let best: { missionId: string; index: number; at: string } | undefined;
  for (const m of state.missions) {
    if (m.status !== "done") continue;
    const at = state.sorties.find((x) => x.missionId === m.id && x.completedAt)?.completedAt;
    if (!at) continue;
    const index = Math.max(-1, ...eventsForMission(state, m.id).map((e) => state.scores.indexOf(e)));
    if (!best || index > best.index || (index === best.index && at > best.at)) best = { missionId: m.id, index, at };
  }
  return best ? summarizeClear(state, roster, best.missionId, { viewerId }) : null;
}
