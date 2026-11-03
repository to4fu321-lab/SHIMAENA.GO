// 「ある雪の朝」の状態。地図・得点バー・雪HP はこの形を読む。
// T03 では固定のデモ状態、T06 以降は保存先から組み立てる。
import { clockText, jstMinutes } from "../jst";
import { formatKg, snowComparison } from "../snowkg";
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

/** 今朝の相手になる家（返事なしの家は見守りなので数えない） */
function targets(state: MorningState): Mission[] {
  return state.missions.filter((m) => m.status !== "no_answer");
}

/** 今朝の雪HP: 予報(cm) × 相手の家の数。完了した家の分だけ減る。0 で討伐 */
export function snowHp(state: MorningState): { current: number; max: number } {
  const all = targets(state);
  const done = all.filter((m) => m.status === "done").length;
  const max = Math.round(state.rollcall.forecastCm * all.length);
  return { current: Math.round(state.rollcall.forecastCm * (all.length - done)), max };
}

/** 今朝、町内みんなでどけた雪の合計（完了した家の kg を足す。チーム対抗ではなく共同の達成） */
export function snowTotal(state: MorningState): { kg: number; houses: number; label: string; comparison: string } {
  const done = state.missions.filter((m) => m.status === "done" && (m.snowKg ?? 0) > 0);
  const kg = done.reduce((a, m) => a + (m.snowKg ?? 0), 0);
  return { kg, houses: done.length, label: formatKg(kg), comparison: snowComparison(kg) };
}

export interface Progress {
  total: number;
  done: number;
  left: number;
  /** 相手の家がすべて完了（＝雪ボスの討伐） */
  allDone: boolean;
  /** 討伐の時刻（HH:mm、日本時間）。最後の家の完了時刻 */
  defeatedAt?: string;
}

/** 今朝の進み具合: ○/○軒、あと○軒、討伐したか */
export function progress(state: MorningState): Progress {
  const all = targets(state);
  const done = all.filter((m) => m.status === "done").length;
  const allDone = all.length > 0 && done === all.length;
  let defeatedAt: string | undefined;
  if (allDone) {
    const times = state.sorties.flatMap((s) => (s.completedAt ? [new Date(s.completedAt).getTime()] : []));
    if (times.length > 0) defeatedAt = clockText(jstMinutes(new Date(Math.max(...times))));
  }
  return { total: all.length, done, left: all.length - done, allDone, defeatedAt };
}
