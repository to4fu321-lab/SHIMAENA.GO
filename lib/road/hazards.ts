// 道の危険の報告（11/4 本人の指示）。冬に「知らせたい」と思う5つ。純粋なデータと計算だけ。
import { distanceM } from "../game/help";
import type { LatLng } from "../types";

export type HazardId = "no_plow" | "narrow" | "no_sidewalk" | "slush" | "ice";

export interface Hazard {
  id: HazardId;
  emoji: string;
  /** ボタン・地図の短い名前 */
  label: string;
  /** 通知の1文 */
  sentence: string;
}

export const HAZARDS: Hazard[] = [
  { id: "no_plow", emoji: "🚧", label: "除雪が来ていない", sentence: "除雪がまだ来ていない道があります。" },
  { id: "narrow", emoji: "🚗", label: "道が細い・車が通りにくい", sentence: "除雪のあとも道が細く、車が通りにくくなっています。" },
  { id: "no_sidewalk", emoji: "🚶", label: "歩道がない", sentence: "雪で歩道がなくなっている所があります。車に気をつけて。" },
  { id: "slush", emoji: "🌀", label: "ぐさぐさ雪・スタック注意", sentence: "ぐさぐさの雪で、車がスタックしそうな道があります。" },
  { id: "ice", emoji: "🧊", label: "凍って転びやすい", sentence: "凍って転びやすい所があります。足元に気をつけて。" },
];

export function hazard(id: string): Hazard | undefined {
  return HAZARDS.find((h) => h.id === id);
}

export interface RoadReport {
  id: string;
  participantId: string;
  hazard: HazardId;
  /** 写真を撮った場所（道なので家とちがい、そのままピンにする） */
  location: LatLng;
  note?: string;
  at: string; // ISO
  date: string; // YYYY-MM-DD（日本時間）
  /** 近くの人へ知らせ終えた時刻（夜は朝まで空のまま） */
  notifiedAt?: string;
}

/** 近くの人に知らせる範囲（m）・1人1日の上限・同じ報告とみなす距離と時間 */
export const ALERT_RADIUS_M = 300;
export const ALERT_DAILY_CAP = 3;
export const SAME_SPOT_M = 50;
export const SAME_SPOT_MS = 2 * 60 * 60 * 1000;
/** 地図に出す時間 */
export const SHOW_MS = 24 * 60 * 60 * 1000;

/** 2時間以内に、50m以内で、同じ種類の報告がもう知らされているか（同じ場所の通知はまとめて1回） */
export function alreadyAlerted(r: RoadReport, others: RoadReport[]): boolean {
  const t = Date.parse(r.at);
  return others.some(
    (o) =>
      o.id !== r.id &&
      o.hazard === r.hazard &&
      o.notifiedAt !== undefined &&
      Math.abs(t - Date.parse(o.at)) <= SAME_SPOT_MS &&
      distanceM(o.location, r.location) <= SAME_SPOT_M,
  );
}

export interface AlertCandidate {
  participantId: string;
  lineUserId?: string;
  home: LatLng;
  /** 道の報告を受け取る（オンにした人だけ） */
  enabled: boolean;
  /** 今日すでに届いた数 */
  sentToday: number;
}

/** 知らせる相手: オンにしていて、LINE があり、報告した本人でなく、家が 300m 以内で、今日3回未満の人 */
export function pickRecipients(r: RoadReport, people: AlertCandidate[]): { participantId: string; lineUserId: string; distance: number }[] {
  return people
    .filter((p) => p.enabled && p.lineUserId && p.participantId !== r.participantId && p.sentToday < ALERT_DAILY_CAP)
    .map((p) => ({ participantId: p.participantId, lineUserId: p.lineUserId!, distance: Math.round(distanceM(p.home, r.location)) }))
    .filter((p) => p.distance <= ALERT_RADIUS_M)
    .sort((a, b) => a.distance - b.distance);
}

/** 「12分前」「3時間前」 */
export function agoText(at: string, now: Date = new Date()): string {
  const min = Math.max(0, Math.round((now.getTime() - Date.parse(at)) / 60000));
  if (min < 1) return "たった今";
  if (min < 60) return `${min}分前`;
  return `${Math.round(min / 60)}時間前`;
}
