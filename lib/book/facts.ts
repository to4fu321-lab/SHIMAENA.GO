// 町の週刊絵本（spec v1.27）の材料: 1週間の朝の記録から、絵本に書いてよい事実だけを取り出す（プログラムだけで決まる）。
// 人の名前・家の番号・場所は入れない。登場するのはシマエナガとチームの色だけ。
import { addDays } from "../jst";
import type { MorningRecord } from "../morning/flow";
import { snowComparison } from "../snowkg";
import { getTeam } from "../teams";
import type { TeamId } from "../types";

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

export interface BookMorning {
  date: string;
  /** 曜日（月・火 …） */
  weekday: string;
  snowName?: string;
  forecastCm: number;
  /** 開いた道（完了した家） */
  houses: number;
  snowKg: number;
  /** 来たシマエナガ（のべではなく、その朝の人数） */
  birds: number;
  teams: TeamId[];
  thanks: number;
  cheers: number;
  /** 今日の話題（lib/topic/day.ts。あれば） */
  topic?: string;
}

export interface BookFacts {
  weekStart: string;
  weekEnd: string;
  /** 例: 12月14日〜12月20日 */
  span: string;
  mornings: BookMorning[];
  totals: { mornings: number; houses: number; snowKg: number; comparison: string; birds: number; thanks: number; cheers: number };
  /** いちばん雪の多かった朝（なければ undefined） */
  biggest?: BookMorning;
  /** 今週のチームの点（順位の順） */
  teams: { id: TeamId; name: string; color: string; colorName: string; points: number }[];
  /** 今週出てきた話題 */
  topics: string[];
}

const md = (ymd: string) => {
  const [, m, d] = ymd.split("-").map(Number);
  return `${m}月${d}日`;
};

export function weekdayOf(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** 1週間の記録 → 絵本の材料。topics は日付 → 話題の名前 */
export function bookFacts(records: MorningRecord[], weekStart: string, topics: Record<string, string> = {}): BookFacts {
  const weekEnd = addDays(weekStart, 6);
  const mornings: BookMorning[] = records
    .filter((r) => r.morning.rollcall.date >= weekStart && r.morning.rollcall.date <= weekEnd)
    .sort((a, b) => (a.morning.rollcall.date < b.morning.rollcall.date ? -1 : 1))
    .map((r) => {
      const m = r.morning;
      const done = m.missions.filter((x) => x.status === "done");
      const doneIds = new Set(done.map((x) => x.id));
      const sorties = m.sorties.filter((x) => doneIds.has(x.missionId) && x.status === "done");
      return {
        date: m.rollcall.date,
        weekday: weekdayOf(m.rollcall.date),
        ...(m.rollcall.snowName ? { snowName: m.rollcall.snowName } : {}),
        forecastCm: m.rollcall.forecastCm,
        houses: done.length,
        snowKg: done.reduce((a, x) => a + (x.snowKg ?? 0), 0),
        birds: new Set(sorties.map((x) => x.participantId)).size,
        teams: [...new Set(sorties.map((x) => x.teamId))],
        thanks: Object.keys(r.thanks ?? {}).length,
        cheers: Object.values(r.cheers ?? {}).reduce((a, x) => a + x.length, 0),
        ...(topics[m.rollcall.date] ? { topic: topics[m.rollcall.date] } : {}),
      };
    });
  const points: Record<TeamId, number> = { salvia: 0, marigold: 0, lupinus: 0 };
  for (const r of records) {
    if (r.morning.rollcall.date < weekStart || r.morning.rollcall.date > weekEnd) continue;
    for (const e of r.morning.scores) points[e.teamId] += e.points;
  }
  const snowKg = mornings.reduce((a, x) => a + x.snowKg, 0);
  const biggest = [...mornings].sort((a, b) => b.forecastCm - a.forecastCm || b.houses - a.houses)[0];
  return {
    weekStart,
    weekEnd,
    span: `${md(weekStart)}〜${md(weekEnd)}`,
    mornings,
    totals: {
      mornings: mornings.length,
      houses: mornings.reduce((a, x) => a + x.houses, 0),
      snowKg,
      comparison: snowKg > 0 ? snowComparison(snowKg) : "",
      birds: mornings.reduce((a, x) => a + x.birds, 0),
      thanks: mornings.reduce((a, x) => a + x.thanks, 0),
      cheers: mornings.reduce((a, x) => a + x.cheers, 0),
    },
    ...(biggest ? { biggest } : {}),
    teams: (Object.keys(points) as TeamId[])
      .map((id) => ({ id, name: getTeam(id).name, color: getTeam(id).color, colorName: getTeam(id).colorName, points: points[id] }))
      .sort((a, b) => b.points - a.points),
    topics: [...new Set(mornings.flatMap((x) => (x.topic ? [x.topic] : [])))],
  };
}

/** 絵本の文に出してよい数（事実にある数と、日付の数） */
export function allowedNumbers(f: BookFacts): Set<number> {
  const n = new Set<number>([1, 2, 3, 6, 7]);
  const add = (x: number) => n.add(Math.round(x));
  for (const v of Object.values(f.totals)) if (typeof v === "number") add(v);
  for (const m of f.mornings) [m.forecastCm, m.houses, m.snowKg, m.birds, m.thanks, m.cheers, ...m.date.split("-").map(Number)].forEach(add);
  for (const t of f.teams) add(t.points);
  for (const d of [f.weekStart, f.weekEnd]) d.split("-").map(Number).forEach(add);
  return n;
}
