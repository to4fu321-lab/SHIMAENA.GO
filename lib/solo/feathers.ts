// 羽ポイントと連続出動日数の計算（純粋な関数）。チーム得点（lib/game/score.ts）とは別の個人の記録。個人順位は出さない。
import { addDays } from "../jst";
import type { Card, SoloLog } from "../types";
import { SOLO_BONUS, type SoloBonusKind } from "./missions";

const isBonus = (l: SoloLog) => l.kind.startsWith("bonus_");

export function totalFeathers(logs: SoloLog[]): number {
  return logs.reduce((a, l) => a + l.feathers, 0);
}

export function feathersOn(logs: SoloLog[], date: string): number {
  return logs.filter((l) => l.date === date).reduce((a, l) => a + l.feathers, 0);
}

/** 活動した日（ボーナスの行は数えない） */
export function activeDates(logs: SoloLog[]): Set<string> {
  return new Set(logs.filter((l) => !isBonus(l)).map((l) => l.date));
}

/**
 * 連続出動日数。今日に活動があれば今日から、なければ昨日から数える（昨日まで続いていれば「続いている」）。
 * どちらにもなければ 0。
 */
export function streakDays(dates: Set<string>, today: string): number {
  let d = dates.has(today) ? today : dates.has(addDays(today, -1)) ? addDays(today, -1) : null;
  let n = 0;
  while (d && dates.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/** 連続の始まりの日（streak 日前） */
function streakStart(today: string, streak: number, dates: Set<string>): string {
  const end = dates.has(today) ? today : addDays(today, -1);
  return addDays(end, -(streak - 1));
}

/**
 * いま付けてよいボーナス: 初回出動（1回だけ）、3日連続・5日連続（同じ連続の中で1回だけ）。
 * logs には今日の活動（いま付けた行）を含めて渡す。
 */
export function bonusesDue(logs: SoloLog[], today: string): SoloBonusKind[] {
  const dates = activeDates(logs);
  if (dates.size === 0) return [];
  const due: SoloBonusKind[] = [];
  if (!logs.some((l) => l.kind === "bonus_first")) due.push("bonus_first");
  const streak = streakDays(dates, today);
  const start = streakStart(today, streak, dates);
  const given = (k: SoloBonusKind) => logs.some((l) => l.kind === k && l.date >= start);
  if (streak >= 3 && !given("bonus_streak3")) due.push("bonus_streak3");
  if (streak >= 5 && !given("bonus_streak5")) due.push("bonus_streak5");
  return due;
}

export function bonusLog(kind: SoloBonusKind, participantId: string, date: string, at: string, id: string): SoloLog {
  return { id, participantId, date, kind, onsite: false, feathers: SOLO_BONUS[kind].feathers, at };
}

export interface NextCard {
  label: string;
  /** どうすれば取れるか */
  hint: string;
  /** あと何日（連続のもの） */
  daysLeft?: number;
}

/** 次に獲得できるカード（画面の「次に獲得できるカード」） */
export function nextCard(cards: Card[], streak: number): NextCard {
  if (cards.length === 0) return { label: "はじめてのソロ出動", hint: "ミッションを1つ終えると最初のカード" };
  if (!cards.some((c) => c.style === "pixel")) {
    const left = Math.max(1, 5 - streak);
    return { label: "五日連続の群れ（ドット絵）", hint: `5日連続で出動すると。あと${left}日`, daysLeft: left };
  }
  if (!cards.some((c) => c.style === "retrowave")) return { label: "早朝の群れ（80s レトロウェーブ）", hint: "雪の朝、7:30 までに家を1軒終える" };
  if (!cards.some((c) => c.style === "eijin")) return { label: "混成の群れ（湾岸ポップ）", hint: "2チームで同じ家に" };
  if (!cards.some((c) => c.style === "kirie")) return { label: "大雪の群れ（切り絵）", hint: "20cm 以上の大雪の朝に" };
  return { label: "図鑑はコンプリート", hint: "次は仲間を誘ってみましょう" };
}
