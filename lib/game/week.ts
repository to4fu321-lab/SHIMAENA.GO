// 週の集計（日〜土）とチームのシャッフル。spec 5。
import type { Participant, TeamId } from "../types";

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
