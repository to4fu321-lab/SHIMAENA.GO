// 得点計算。spec 5 の得点表をそのまま関数にしたもの。お金には換えない。
import type { ScoreEvent, ScoreReason, Sortie, TeamId } from "../types";

export const POINTS = {
  mission_done: 10, // 完了した人1人につき
  early: 5, // 7:30 までに完了（1人につき）
  rescue: 10, // 赤点滅の家に、自分の割り当て完了後に駆けつけ
  flock: 5, // 同じチーム2人以上で1軒（その人たち各自）
  mixed: 5, // 2チーム以上が同じ家で合流（各チームに1回）
  scout: 3,
  supply: 3,
  requester_joined: 3, // 依頼者本人も一緒に作業
  weekly_goal: 20, // チーム全員に
} as const satisfies Record<ScoreReason, number>;

/** 早朝ボーナスの締め切り（日本時間 7:30） */
export function isEarly(completedAtIso: string): boolean {
  const jst = new Date(new Date(completedAtIso).getTime() + 9 * 3600 * 1000);
  return jst.getUTCHours() * 60 + jst.getUTCMinutes() <= 7 * 60 + 30;
}

let seq = 0;
const ev = (teamId: TeamId, points: number, reason: ScoreReason, at: string, participantId?: string): ScoreEvent => ({
  id: `sc${Date.now().toString(36)}${(seq++).toString(36)}`,
  teamId,
  participantId,
  points,
  reason,
  at,
});

/**
 * 1軒のミッションが完了したときの得点。
 * @param sorties そのミッションの出撃（完了したものだけが対象）
 * @param requesterJoined 依頼者が「一緒なら」と答えて一緒に作業したか
 */
export function scoreMission(sorties: Sortie[], at: string, requesterJoined = false): ScoreEvent[] {
  const done = sorties.filter((s) => s.status === "done");
  const events: ScoreEvent[] = [];
  const byTeam = new Map<TeamId, Sortie[]>();
  for (const s of done) byTeam.set(s.teamId, [...(byTeam.get(s.teamId) ?? []), s]);

  for (const s of done) {
    events.push(ev(s.teamId, POINTS.mission_done, "mission_done", at, s.participantId));
    if (s.completedAt && isEarly(s.completedAt)) events.push(ev(s.teamId, POINTS.early, "early", at, s.participantId));
    if (s.rescue) events.push(ev(s.teamId, POINTS.rescue, "rescue", at, s.participantId));
  }
  for (const [teamId, members] of byTeam) {
    if (members.length >= 2) for (const m of members) events.push(ev(teamId, POINTS.flock, "flock", at, m.participantId));
  }
  if (byTeam.size >= 2) for (const teamId of byTeam.keys()) events.push(ev(teamId, POINTS.mixed, "mixed", at));
  if (requesterJoined && done.length > 0) {
    // 依頼者はチームに属さないので、いちばん人数の多かったチーム（同数なら先に来たチーム）に入れる
    const [teamId] = [...byTeam.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    events.push(ev(teamId, POINTS.requester_joined, "requester_joined", at));
  }
  return events;
}

/** 偵察・補給の得点 */
export function scoreSupport(kind: "scout" | "supply", teamId: TeamId, participantId: string, at: string): ScoreEvent {
  return ev(teamId, POINTS[kind], kind, at, participantId);
}

/**
 * 週の目標: そのチームが割り当てられた軒がすべて 8:00 までに完了していたら、チーム全員に +20。
 * @param missions その週にチームが関わったミッションの完了時刻（未完了は null）
 */
export function scoreWeeklyGoal(teamId: TeamId, completedAt: (string | null)[], memberIds: string[], at: string): ScoreEvent[] {
  if (completedAt.length === 0) return [];
  const allBy8 = completedAt.every((c) => {
    if (!c) return false;
    const jst = new Date(new Date(c).getTime() + 9 * 3600 * 1000);
    return jst.getUTCHours() < 8;
  });
  return allBy8 ? memberIds.map((id) => ev(teamId, POINTS.weekly_goal, "weekly_goal", at, id)) : [];
}

export function totalsByTeam(events: ScoreEvent[]): Record<TeamId, number> {
  const t: Record<TeamId, number> = { salvia: 0, marigold: 0, lupinus: 0 };
  for (const e of events) t[e.teamId] += e.points;
  return t;
}
