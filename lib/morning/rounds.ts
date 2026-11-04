// 1日に何回でも（spec v1.8）。純粋な関数だけ（保存・LINE は ops.ts）。
// - いま雪かき中の人数（地図とホームに出す）
// - 降り続く日: 終わった家を、もう一度「雪かき待ち」にする（2回目・3回目）
import type { Mission, Sortie } from "../types";

interface State {
  missions: Mission[];
  sorties: Sortie[];
}

/** いま雪かき中（「行く」を押して、まだ終わっていない）の人数。同じ人は1人と数える */
export function activeHelpers(state: State): number {
  return new Set(state.sorties.filter((x) => x.status === "going").map((x) => x.participantId)).size;
}

/** 1日に開く回数の上限（3回まで。降り続いても4回目は作らない） */
export const MAX_ROUNDS = 3;

/** 家ごとの最後の完了時刻（ISO）。まだ終わっていない回がある家は入れない */
export function lastDoneByBase(state: State): Map<string, { mission: Mission; doneAt: string }> {
  const out = new Map<string, { mission: Mission; doneAt: string }>();
  const openBases = new Set(state.missions.filter((m) => m.status !== "done").map((m) => m.baseId));
  for (const m of state.missions) {
    if (m.status !== "done" || openBases.has(m.baseId)) continue;
    const times = state.sorties.filter((x) => x.missionId === m.id && x.completedAt).map((x) => x.completedAt!);
    const doneAt = times.sort().at(-1);
    if (!doneAt) continue;
    const prev = out.get(m.baseId);
    if (!prev || (prev.mission.round ?? 1) < (m.round ?? 1)) out.set(m.baseId, { mission: m, doneAt });
  }
  return out;
}

/**
 * 終わった家をもう一度開く。shouldReopen が true を返した家だけ、新しい回のミッションを足す（前の回の記録・得点・カードはそのまま）。
 * 人はまだ誰も向かっていないので「人手不足」（赤点滅）で開く。足した数を返す。
 */
export function reopenDone(state: State, nowIso: string, shouldReopen: (doneAt: string) => boolean): Mission[] {
  const added: Mission[] = [];
  for (const { mission, doneAt } of lastDoneByBase(state).values()) {
    const round = (mission.round ?? 1) + 1;
    if (round > MAX_ROUNDS || !shouldReopen(doneAt)) continue;
    const next: Mission = {
      ...mission,
      id: `${mission.id.replace(/-r\d+$/, "")}-r${round}`,
      status: "short",
      startAt: nowIso,
      round,
      reason: `降り続いているので${round}回目`,
      snowKg: undefined,
    };
    state.missions.push(next);
    added.push(next);
  }
  return added;
}
