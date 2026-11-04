// 今朝の実況（spec v1.1 9-6）の材料。Claude には「本当の集計」だけを渡し、数字を作らせない。
import { clockText, jstMinutes } from "../jst";
import { TOWN } from "../town";
import type { MorningRecord } from "./flow";
import type { Roster } from "./roster";
import { progress } from "./view";

export interface RecapInput {
  date: string; // YYYY-MM-DD
  townName: string;
  forecastCm: number;
  snowName?: string;
  startTime: string; // 例: 7:00
  housesTotal: number;
  housesDone: number;
  allDone: boolean;
  defeatedAt?: string; // HH:mm
  /** 今朝動いた人（手伝う側）の数 */
  movers: number;
  /** 出撃したチームの数（1〜3） */
  teamsOut: number;
  firstDoneAt?: string; // HH:mm
  lastDoneAt?: string; // HH:mm
  /** 2チーム以上が合流した家の数 */
  mixedHouses: number;
  /** 自分の家を終えてから駆けつけた回数 */
  rescues: number;
  /** 偵察・補給（10分）で加わった回数 */
  fiveMinuteJoins: number;
  /** いまも人手が足りない家の数 */
  shortRemaining: number;
  /** 点呼に返事がない家の数 */
  noAnswer: number;
}

const hm = (iso: string) => clockText(jstMinutes(new Date(iso)));

/** 今朝の状態から実況の材料をまとめる（純粋な関数） */
export function buildRecapInput(record: MorningRecord, roster: Roster): RecapInput {
  const m = record.morning;
  const prog = progress(m);
  const sorties = m.sorties;
  const doneTimes = sorties.flatMap((s) => (s.completedAt ? [new Date(s.completedAt).getTime()] : []));
  const teamsByMission = new Map<string, Set<string>>();
  for (const s of sorties) teamsByMission.set(s.missionId, new Set([...(teamsByMission.get(s.missionId) ?? []), s.teamId]));
  const mixedHouses = m.missions.filter((x) => x.status === "done" && (teamsByMission.get(x.id)?.size ?? 0) >= 2).length;
  const helperIds = new Set(roster.participants.filter((p) => p.role === "helper").map((p) => p.id));
  return {
    date: m.rollcall.date,
    townName: TOWN.name.replace(/（.*）$/, ""),
    forecastCm: m.rollcall.forecastCm,
    snowName: m.rollcall.snowName,
    startTime: "7:00",
    housesTotal: prog.total,
    housesDone: prog.done,
    allDone: prog.allDone,
    defeatedAt: prog.defeatedAt,
    movers: new Set(sorties.map((s) => s.participantId).filter((id) => helperIds.has(id))).size,
    teamsOut: new Set(sorties.map((s) => s.teamId)).size,
    firstDoneAt: doneTimes.length ? hm(new Date(Math.min(...doneTimes)).toISOString()) : undefined,
    lastDoneAt: doneTimes.length ? hm(new Date(Math.max(...doneTimes)).toISOString()) : undefined,
    mixedHouses,
    rescues: sorties.filter((s) => s.rescue).length,
    fiveMinuteJoins: sorties.filter((s) => s.subtaskIds.includes("scout")).length,
    shortRemaining: m.missions.filter((x) => x.status === "short").length,
    noAnswer: m.missions.filter((x) => x.status === "no_answer").length,
  };
}
