// 「ある雪の朝」の状態。地図・得点バー・雪HP はこの形を読む。
// T03 では固定のデモ状態、T06 以降は保存先から組み立てる。
import type { Mission, Rollcall, ScoreEvent, Sortie, TeamId } from "../types";

export interface MorningState {
  rollcall: Rollcall;
  missions: Mission[];
  sorties: Sortie[];
  scores: ScoreEvent[];
  /** 画面を見ている人（デモでは手伝う側の1人） */
  viewerId: string;
}

export interface BaseView {
  baseId: string;
  status: Mission["status"] | "none";
  /** 向かっている・完了したチーム（来た順） */
  teams: TeamId[];
  requiredPeople: number;
  goingPeople: number;
}

/** 拠点ごとの見え方（色を決めるための要約） */
export function viewBases(state: MorningState): Map<string, BaseView> {
  const views = new Map<string, BaseView>();
  for (const m of state.missions) {
    const sorties = state.sorties.filter((s) => s.missionId === m.id);
    const teams: TeamId[] = [];
    for (const s of sorties) if (!teams.includes(s.teamId)) teams.push(s.teamId);
    views.set(m.baseId, {
      baseId: m.baseId,
      status: m.status,
      teams,
      requiredPeople: m.requiredPeople,
      goingPeople: sorties.length,
    });
  }
  return views;
}

export function teamTotals(state: MorningState): Record<TeamId, number> {
  const totals: Record<TeamId, number> = { salvia: 0, marigold: 0, lupinus: 0 };
  for (const e of state.scores) totals[e.teamId] += e.points;
  return totals;
}

/** 今朝の雪HP: 予報(cm) × 拠点数。完了した拠点の分だけ減る */
export function snowHp(state: MorningState): { current: number; max: number } {
  const max = Math.round(state.rollcall.forecastCm * state.missions.length);
  const done = state.missions.filter((m) => m.status === "done").length;
  return { current: Math.round(state.rollcall.forecastCm * (state.missions.length - done)), max };
}
