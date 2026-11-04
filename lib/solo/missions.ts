// ソロミッションの一覧（spec v1.3）。1人でもできる 3〜10分の仕事。純粋なデータ。
// 現地（onsite）とオンラインをはっきり分け、オンラインの確認・応援は「雪かき完了」にはしない。
import type { SoloKind } from "../types";

export type SoloMissionKind = Exclude<SoloKind, "bonus_first" | "bonus_streak3" | "bonus_streak5">;
export type SoloBonusKind = Extract<SoloKind, "bonus_first" | "bonus_streak3" | "bonus_streak5">;

export interface SoloMission {
  kind: SoloMissionKind;
  label: string;
  /** 何をするか（1文） */
  description: string;
  minutes: 3 | 10;
  onsite: boolean;
  difficulty: 1 | 2 | 3;
  /** 完了で入る羽 */
  feathers: number;
  /** 写真を付けられるか（任意。付けると Claude が確認して「確認済み」） */
  photo: "none" | "optional";
  /** 時間を決めず終わるまで。始め（Before）と終わり（After）の写真で報告する（11/4 本人の指示） */
  beforeAfter?: boolean;
  /** カードの「時間」の欄（なければ「◯分」） */
  timeLabel?: string;
}

/** 家の完了（既存の朝の一本道）で入る羽。チーム得点（10点）とは別の台帳 */
export const HELP_HOUSE_FEATHERS = 10;

/** いま選べるソロミッション（11/4 本人の指示で2つに絞った: 道の危険を知らせる・自分の家の雪かき。家の手伝いは作戦中だけ） */
export const SOLO_MISSIONS: SoloMission[] = [
  { kind: "report_snow", label: "道の危険を知らせる", description: "除雪がまだ・細い道・歩道なし・ぐさぐさ・つるつる。写真と場所で近所に知らせる", minutes: 10, onsite: true, difficulty: 1, feathers: 5, photo: "optional", timeLabel: "すぐ" },
  { kind: "own_house", label: "自分の家の雪かき", description: "玄関前の雪を、終わるまで。始めと終わりに写真を撮る", minutes: 10, onsite: true, difficulty: 2, feathers: 8, photo: "optional", beforeAfter: true, timeLabel: "自由" },
  { kind: "help_house", label: "1軒の雪かきを手伝う", description: "今朝の作戦の家に10分だけ加わる（完了は写真で）", minutes: 10, onsite: true, difficulty: 2, feathers: HELP_HOUSE_FEATHERS, photo: "none" },
];

/** もう選べないミッション（前の記録の名前を出すためだけに残す） */
const RETIRED: Pick<SoloMission, "kind" | "label">[] = [
  { kind: "patrol", label: "雪の状況を見回る" },
  { kind: "check_spot", label: "雪かき可能な場所を確認する" },
  { kind: "find_help", label: "仲間が必要な家を確認する" },
  { kind: "check_area", label: "地域の状況を確認する" },
  { kind: "report_online", label: "雪の状況を報告する" },
  { kind: "find_online", label: "助けが必要な場所を発見する" },
];

export const SOLO_BONUS: Record<SoloBonusKind, { label: string; feathers: number }> = {
  bonus_first: { label: "初回出動", feathers: 3 },
  bonus_streak3: { label: "3日連続出動", feathers: 5 },
  bonus_streak5: { label: "5日連続出動", feathers: 10 },
};

export function soloMission(kind: string): SoloMission | undefined {
  return SOLO_MISSIONS.find((m) => m.kind === kind);
}

export function isSoloMissionKind(kind: string): kind is SoloMissionKind {
  return SOLO_MISSIONS.some((m) => m.kind === kind);
}

/** 台帳の種類の表示名（ボーナスも含む） */
export function soloLabel(kind: SoloKind): string {
  return soloMission(kind)?.label ?? RETIRED.find((m) => m.kind === kind)?.label ?? SOLO_BONUS[kind as SoloBonusKind]?.label ?? kind;
}

/** チームに入る点の目安（spec v1.7）。家の手伝いは朝の一本道で数えるので null */
export function soloTeamPoints(m: Pick<SoloMission, "kind" | "onsite">): number | null {
  if (m.kind === "help_house") return null;
  if (!m.onsite) return 1;
  return m.kind === "own_house" ? 5 : 3;
}
