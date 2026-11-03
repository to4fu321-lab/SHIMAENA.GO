// 週の集計（日〜土）とチームのシャッフル。spec 5。
import type { MorningRecord } from "../morning/flow";
import type { Roster } from "../morning/roster";
import type { Participant, ScoreEvent, TeamId } from "../types";
import { scoreWeeklyGoal } from "./score";

/** その日を含む週の日曜日（YYYY-MM-DD） */
export function weekStart(dateYmd: string): string {
  const d = new Date(`${dateYmd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

/** 週に出撃した日数から称号を決める（3日で称号、5日で称号＋レアカード確定） */
export function weeklyTitle(sortieDays: number): { title: string | null; rareCard: boolean } {
  if (sortieDays >= 5) return { title: "朝の群れの主", rareCard: true };
  if (sortieDays >= 3) return { title: "早起きのエナガ", rareCard: false };
  return { title: null, rareCard: false };
}

export interface WeeklySummary {
  weekStart: string;
  days: number; // 雪の朝の数
  missionsDone: number;
  teamTotals: Record<TeamId, number>;
  /** 得点の多い順 */
  ranking: TeamId[];
  /** 週の目標（関わった家が全部 8:00 まで）を達成したチーム */
  goalTeams: TeamId[];
  /** 週の目標ボーナス（チーム全員 +20）。呼ぶ側が今朝の得点に足す */
  goalEvents: ScoreEvent[];
  /** 手伝う側ごとの出撃日数 */
  sortieDays: Record<string, number>;
  titles: { participantId: string; nickname: string; title: string; rareCard: boolean }[];
  /** 依頼者ごとに、今週手伝ってもらった回数（家族への「今週は3回」） */
  helpedCount: Record<string, number>;
}

/** 今週の朝の記録をまとめる（spec 2 日曜・5 週の目標と称号・8 家族） */
export function weeklySummary(records: MorningRecord[], roster: Roster, weekStartYmd: string, at: string): WeeklySummary {
  const teamTotals: Record<TeamId, number> = { salvia: 0, marigold: 0, lupinus: 0 };
  const sortieDaySets = new Map<string, Set<string>>();
  const helpedCount: Record<string, number> = {};
  const completedByTeam = new Map<TeamId, (string | null)[]>();
  let missionsDone = 0;
  for (const r of records) {
    for (const e of r.morning.scores) teamTotals[e.teamId] += e.points;
    for (const m of r.morning.missions) {
      if (m.status === "done") {
        missionsDone++;
        const base = roster.bases.find((b) => b.id === m.baseId);
        if (base) helpedCount[base.requesterId] = (helpedCount[base.requesterId] ?? 0) + 1;
      }
      const sorties = r.morning.sorties.filter((x) => x.missionId === m.id);
      const completedAt = m.status === "done" ? (sorties.find((x) => x.completedAt)?.completedAt ?? null) : null;
      for (const team of new Set(sorties.map((x) => x.teamId))) {
        completedByTeam.set(team, [...(completedByTeam.get(team) ?? []), completedAt]);
      }
    }
    for (const x of r.morning.sorties) {
      if (x.status !== "done") continue;
      const set = sortieDaySets.get(x.participantId) ?? new Set<string>();
      set.add(r.morning.rollcall.date);
      sortieDaySets.set(x.participantId, set);
    }
  }
  const sortieDays: Record<string, number> = {};
  for (const [id, set] of sortieDaySets) sortieDays[id] = set.size;

  const goalTeams: TeamId[] = [];
  const goalEvents: ScoreEvent[] = [];
  for (const [team, completed] of completedByTeam) {
    const members = roster.participants.filter((p) => p.role === "helper" && p.teamId === team).map((p) => p.id);
    const events = scoreWeeklyGoal(team, completed, members, at);
    if (events.length > 0) {
      goalTeams.push(team);
      goalEvents.push(...events);
      teamTotals[team] += events.reduce((a, e) => a + e.points, 0);
    }
  }
  const ranking = (Object.keys(teamTotals) as TeamId[]).sort((a, b) => teamTotals[b] - teamTotals[a]);
  const titles = roster.participants
    .filter((p) => p.role === "helper")
    .map((p) => ({ p, t: weeklyTitle(sortieDays[p.id] ?? 0) }))
    .filter(({ t }) => t.title)
    .map(({ p, t }) => ({ participantId: p.id, nickname: p.nickname, title: t.title!, rareCard: t.rareCard }));
  return { weekStart: weekStartYmd, days: records.length, missionsDone, teamTotals, ranking, goalTeams, goalEvents, sortieDays, titles, helpedCount };
}

/** 決まった種から作る乱数（同じ週なら同じ結果） */
// mulberry32: 小さい種（1, 2, 3…）でも十分ばらつく
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

/**
 * チームのシャッフル: 「強さ」（その週の出撃回数＋朝に動ける分数）で並べ、
 * 蛇行ドラフト（1→2→3→3→2→1…）で配るので人数も強さも偏りにくい。
 * 同じ強さの人の順番は週ごとの乱数で混ぜる。
 */
export function shuffleTeams(
  helpers: Participant[],
  sortiesThisWeek: Record<string, number>,
  seed: number,
): Record<string, TeamId> {
  const rand = seeded(seed);
  const teams: TeamId[] = ["salvia", "marigold", "lupinus"];
  // 最初に選ぶチームを週ごとに回す（いつも同じチームが得をしないように）
  const shift = Math.floor(rand() * 3);
  const order = teams.map((_, i) => teams[(i + shift) % 3]);
  const strength = (h: Participant) => (sortiesThisWeek[h.id] ?? 0) * 10 + (h.morningMinutes ?? 15) / 15;
  const ranked = helpers
    .map((h) => ({ h, s: strength(h), r: rand() }))
    .sort((a, b) => b.s - a.s || a.r - b.r)
    .map((x) => x.h);
  const result: Record<string, TeamId> = {};
  ranked.forEach((h, i) => {
    const round = Math.floor(i / 3);
    const pos = i % 3;
    result[h.id] = order[round % 2 === 0 ? pos : 2 - pos];
  });
  return result;
}
