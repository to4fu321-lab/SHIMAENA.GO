// 人数が少ない間のチーム分け（spec v1.71。11/17 本人「人数少なかったら、距離が近ければワンチーム、遠ければそれぞれ。500メートル以内が近い」）。
// 3チームに分けると1チーム3人に満たない間（町の人が8人まで）は、強さのバランスより「近い人どうし」を優先する。
//   500m 以内でつながる人（A と B が近く、B と C が近ければ A・B・C）は同じチーム。離れた人のかたまりは、別のチーム。
// 決めるのは距離の計算だけ（AI は使わない）。
import { onTeam } from "../member";
import { loadRoster } from "../morning/roster";
import type { LatLng, Participant, TeamId } from "../types";
import { distanceM } from "./help";
import { assignTeam, TEAM_IDS } from "./team";

/** これより近ければ「近い」 */
export const NEAR_M = 500;
/** この人数までは「人数が少ない」（3チーム × 3人に満たない） */
export const SMALL_TOWN_MAX = 8;

type Member = Pick<Participant, "id" | "location"> & { teamId?: TeamId };

/** 500m 以内でつながる人のかたまり（大きい順。同じ大きさなら、最初の人の並び順） */
export function nearGroups<T extends Member>(members: T[]): T[][] {
  const seen = new Set<string>();
  const groups: T[][] = [];
  for (const m of members) {
    if (seen.has(m.id)) continue;
    const g: T[] = [];
    const stack = [m];
    seen.add(m.id);
    while (stack.length > 0) {
      const x = stack.pop()!;
      g.push(x);
      for (const y of members) {
        if (!seen.has(y.id) && distanceM(x.location, y.location) <= NEAR_M) {
          seen.add(y.id);
          stack.push(y);
        }
      }
    }
    groups.push(g);
  }
  return groups.sort((a, b) => b.length - a.length);
}

/**
 * かたまりごとにチームを1つ。大きいかたまりから、いま人数のいちばん少ないチームへ。
 * 今のチームの色をなるべく変えない（かたまりの中で多い色が空いていれば、その色）。
 * かたまりが4つ以上なら、色はくり返す（離れているので、地図で混ざらない）。
 */
export function teamsByDistance(members: Member[]): Record<string, TeamId> {
  const count: Record<TeamId, number> = { salvia: 0, marigold: 0, lupinus: 0 };
  const used = new Set<TeamId>();
  const result: Record<string, TeamId> = {};
  for (const g of nearGroups(members)) {
    const free = TEAM_IDS.filter((t) => !used.has(t));
    const pool = free.length > 0 ? free : TEAM_IDS;
    const mine = (t: TeamId) => g.filter((m) => m.teamId === t).length;
    const min = Math.min(...pool.map((t) => count[t]));
    const team = pool.filter((t) => count[t] === min).sort((a, b) => mine(b) - mine(a))[0];
    used.add(team);
    count[team] += g.length;
    for (const m of g) result[m.id] = team;
  }
  return result;
}

/**
 * 新しく入る人のチーム。人数が少ない間は、500m 以内のいちばん近い人と同じチーム。近い人がいなければ、人の少ないチーム（別のチーム）。
 * 人数が多くなったら、今までどおり人数のいちばん少ないチーム。
 */
export function teamForLocation(location: LatLng, members: Member[], rand: () => number = Math.random): TeamId {
  const withTeam = members.filter((m): m is Member & { teamId: TeamId } => Boolean(m.teamId));
  const counts: Record<TeamId, number> = { salvia: 0, marigold: 0, lupinus: 0 };
  for (const m of withTeam) counts[m.teamId]++;
  if (withTeam.length + 1 <= SMALL_TOWN_MAX) {
    const near = withTeam
      .map((m) => ({ m, d: distanceM(location, m.location) }))
      .filter((x) => x.d <= NEAR_M)
      .sort((a, b) => a.d - b.d)[0];
    if (near) return near.m.teamId;
  }
  return assignTeam(counts, rand);
}

/** 登録したときのチーム（いまの町の、チームに入っている人を見て決める。自分は数えない） */
export async function teamForNewMember(location: LatLng, selfId?: string): Promise<TeamId> {
  const roster = await loadRoster();
  return teamForLocation(location, roster.participants.filter((p) => p.id !== selfId && onTeam(p)));
}
