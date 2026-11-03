// 公開ページ・SNS カードの数字（spec v1.3）。集計した数だけを返す純粋な関数。
// 氏名・呼び名・家の位置・マスのキー・拠点番号は入れない（LINE 登録前の人や SNS の閲覧者が見るため）。
import { weekStart } from "../game/week";
import type { MorningRecord } from "../morning/flow";
import type { Roster } from "../morning/roster";
import { progress, snowTotal, teamTotals } from "../morning/view";
import { listShort } from "../morning/watch";
import { TOWN } from "../town";
import type { SoloLog, TeamId } from "../types";

export interface PublicStats {
  /** アプリの今日（YYYY-MM-DD） */
  today: string;
  /** 数字が表している朝（雪の朝がなければ最後の朝） */
  morningDate: string;
  townName: string;
  snowName?: string;
  forecastCm: number;
  /** 作戦がもう出ているか */
  planned: boolean;
  housesTotal: number;
  housesDone: number;
  left: number;
  /** 町の雪解け率（0〜100）。終わった家 ÷ 今朝の家 */
  thawPct: number;
  allDone: boolean;
  defeatedAt?: string;
  /** 今朝の雪かきに動いた人 */
  movers: number;
  /** 今日ソロ出動した人 */
  soloPeople: number;
  /** 今日の出動人数（雪かき＋ソロ、重なりは1人） */
  todayPeople: number;
  /** 今日のミッション達成数（家の完了＋ソロミッション） */
  todayMissions: number;
  teamTotals: Record<TeamId, number>;
  snowKg: number;
  snowKgLabel: string;
  snowComparison: string;
  /** 人手が足りない家の数と、いちばん少ない不足人数（拠点番号は出さない） */
  shortHouses: number;
  shortMissingMin: number;
  cheers: number;
  week: { from: string; days: number; housesDone: number; people: number; soloMissions: number };
  recap?: string;
}

/** 家の完了とボーナスを除いた、ソロのミッション（家の完了は housesDone で数える） */
const isSoloMission = (l: SoloLog) => !l.kind.startsWith("bonus_") && l.kind !== "help_house";

export function buildPublicStats(input: {
  record: MorningRecord;
  roster: Roster;
  today: string;
  /** 今週（日曜〜今日）の全員のソロ台帳 */
  soloWeek: SoloLog[];
  /** 今週の朝の記録（今朝を含む） */
  weekRecords: MorningRecord[];
  cheers: number;
}): PublicStats {
  const { record, roster, today, soloWeek, weekRecords, cheers } = input;
  const m = record.morning;
  const prog = progress(m);
  const snow = snowTotal(m);
  const isMorningToday = m.rollcall.date === today;
  const movers = new Set(m.sorties.map((s) => s.participantId));
  const soloToday = soloWeek.filter((l) => l.date === today && !l.kind.startsWith("bonus_"));
  const soloPeople = new Set(soloToday.map((l) => l.participantId));
  const shorts = listShort(record, roster);

  const weekPeople = new Set<string>();
  let weekHouses = 0;
  const days = new Set<string>();
  for (const r of weekRecords) {
    if (r.morning.missions.length === 0) continue;
    days.add(r.morning.rollcall.date);
    weekHouses += r.morning.missions.filter((x) => x.status === "done").length;
    for (const s of r.morning.sorties) if (s.status === "done") weekPeople.add(s.participantId);
  }
  for (const l of soloWeek) {
    if (l.kind.startsWith("bonus_")) continue;
    weekPeople.add(l.participantId);
    days.add(l.date);
  }

  return {
    today,
    morningDate: m.rollcall.date,
    townName: TOWN.name.replace(/（.*）$/, ""),
    snowName: m.rollcall.snowName,
    forecastCm: m.rollcall.forecastCm,
    planned: m.rollcall.status === "planned",
    housesTotal: prog.total,
    housesDone: prog.done,
    left: prog.left,
    thawPct: prog.total > 0 ? Math.round((prog.done / prog.total) * 100) : 0,
    allDone: prog.allDone,
    defeatedAt: prog.defeatedAt,
    movers: movers.size,
    soloPeople: soloPeople.size,
    todayPeople: new Set([...(isMorningToday ? movers : []), ...soloPeople]).size,
    todayMissions: (isMorningToday ? prog.done : 0) + soloToday.filter(isSoloMission).length,
    teamTotals: teamTotals(m),
    snowKg: snow.kg,
    snowKgLabel: snow.label,
    snowComparison: snow.comparison,
    shortHouses: shorts.length,
    shortMissingMin: shorts.length > 0 ? Math.min(...shorts.map((s) => s.missing)) : 0,
    cheers,
    week: {
      from: weekStart(today),
      days: days.size,
      housesDone: weekHouses,
      people: weekPeople.size,
      soloMissions: soloWeek.filter(isSoloMission).length,
    },
    recap: record.recap?.text,
  };
}
