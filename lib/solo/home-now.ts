// いま自分の家の雪かきをしている人（11/4 本人の指示「自宅の雪かき中の人をリアルタイムで」）。
// ソロの「自分の家の雪かき」で「いまから始める」を押すと入り、「クリア！」で抜ける。
// 押したまま忘れた人を数え続けないよう、始めてから HOME_NOW_MINUTES 分たったら数えない。
import type { MorningRecord } from "../morning/flow";

export const HOME_NOW_MINUTES = 40;

type Rec = Pick<MorningRecord, "homeNow">;

function fresh(startedIso: string, now: Date): boolean {
  const t = Date.parse(startedIso);
  return Number.isFinite(t) && now.getTime() - t < HOME_NOW_MINUTES * 60000 && now.getTime() >= t - 60000;
}

/** 古い人を消してから、始めた人を入れる */
export function startHome(rec: Rec, participantId: string, now: Date): void {
  const kept = Object.entries(rec.homeNow ?? {}).filter(([, at]) => fresh(at, now));
  rec.homeNow = { ...Object.fromEntries(kept), [participantId]: now.toISOString() };
}

export function endHome(rec: Rec, participantId: string): boolean {
  if (!rec.homeNow?.[participantId]) return false;
  const { [participantId]: _gone, ...rest } = rec.homeNow;
  void _gone;
  rec.homeNow = rest;
  return true;
}

/** いま自宅で雪かき中の人数 */
export function countHomeNow(rec: Rec, now: Date): number {
  return Object.values(rec.homeNow ?? {}).filter((at) => fresh(at, now)).length;
}

export function isHomeNow(rec: Rec, participantId: string, now: Date): boolean {
  const at = rec.homeNow?.[participantId];
  return Boolean(at && fresh(at, now));
}
