// チーム配属（登録時）。人数がいちばん少ないチームに入れる。同数ならランダム。
import type { TeamId } from "../types";

export const TEAM_IDS: TeamId[] = ["salvia", "marigold", "lupinus"];

export function assignTeam(counts: Record<TeamId, number>, rand: () => number = Math.random): TeamId {
  const min = Math.min(...TEAM_IDS.map((t) => counts[t] ?? 0));
  const candidates = TEAM_IDS.filter((t) => (counts[t] ?? 0) === min);
  return candidates[Math.floor(rand() * candidates.length)] ?? candidates[0];
}

/** 連携コード（6桁の数字。高齢者が打ちやすいように数字だけ） */
export function makeLinkCode(rand: () => number = Math.random): string {
  return String(Math.floor(rand() * 1_000_000)).padStart(6, "0");
}
