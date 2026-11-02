// ヘルプ通知（人手が足りない時）。spec 4。
import type { LatLng, Participant } from "../types";

/** 段階ごとの通知半径（m）。近い順に広げる */
export const HELP_RADII = [300, 600, 1000] as const;

export function distanceM(a: LatLng, b: LatLng): number {
  const mPerLat = 111320;
  const mPerLng = 111320 * Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
  return Math.hypot((a[0] - b[0]) * mPerLat, (a[1] - b[1]) * mPerLng);
}

/**
 * 発火するか:
 * (a) 開始20分前を過ぎても必要人数に足りない
 * (b) 現場の「人手が足りない」ボタン
 * (c) 作戦配信後に新しい「いいえ」が届いた
 */
export function shouldTriggerHelp(input: {
  now: Date;
  startAt: Date;
  going: number;
  required: number;
  shortButtonPressed?: boolean;
  newNoAfterPlan?: boolean;
}): boolean {
  if (input.shortButtonPressed || input.newNoAfterPlan) return true;
  const minutesToStart = (input.startAt.getTime() - input.now.getTime()) / 60000;
  return minutesToStart <= 20 && input.going < input.required;
}

/**
 * その段階で通知する人: 手伝う側で、半径内にいて、まだこの家に向かっていない人。
 * 前の段階で通知済みの人は除く（同じ人に何度も送らない）。
 */
export function helpTargets(
  basePoint: LatLng,
  helpers: Participant[],
  stage: 0 | 1 | 2,
  excludeIds: Set<string>,
): Participant[] {
  const inner = stage === 0 ? 0 : HELP_RADII[stage - 1];
  const outer = HELP_RADII[stage];
  return helpers
    .filter((h) => h.role === "helper" && !excludeIds.has(h.id))
    .map((h) => ({ h, d: distanceM(basePoint, h.location) }))
    .filter(({ d }) => d > inner && d <= outer)
    .sort((a, b) => a.d - b.d)
    .map(({ h }) => h);
}
