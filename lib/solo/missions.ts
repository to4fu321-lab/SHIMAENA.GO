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
}

/** 家の完了（既存の朝の一本道）で入る羽。チーム得点（10点）とは別の台帳 */
export const HELP_HOUSE_FEATHERS = 10;

export const SOLO_MISSIONS: SoloMission[] = [
  // 10分・現地
  { kind: "patrol", label: "雪の状況を見回る", description: "家のまわりを10分歩いて、雪の様子を見る", minutes: 10, onsite: true, difficulty: 1, feathers: 5, photo: "optional" },
  { kind: "report_snow", label: "雪の多い場所を報告する", description: "通りにくい所を1か所、写真で知らせる", minutes: 10, onsite: true, difficulty: 1, feathers: 5, photo: "optional" },
  { kind: "check_spot", label: "雪かき可能な場所を確認する", description: "雪捨て場や通路の空きを見ておく", minutes: 10, onsite: true, difficulty: 1, feathers: 5, photo: "none" },
  { kind: "own_house", label: "自分の家の雪かき", description: "玄関前の雪を、終わるまで。始めと終わりに写真を撮る", minutes: 10, onsite: true, difficulty: 2, feathers: 8, photo: "optional", beforeAfter: true },
  { kind: "find_help", label: "仲間が必要な家を確認する", description: "人手が足りない家が近くにないか見に行く", minutes: 10, onsite: true, difficulty: 1, feathers: 5, photo: "none" },
  { kind: "help_house", label: "1軒の雪かきを手伝う", description: "今朝の作戦の家に10分だけ加わる（完了は写真で）", minutes: 10, onsite: true, difficulty: 2, feathers: HELP_HOUSE_FEATHERS, photo: "none" },
  // 3分・オンライン（雪かき完了にはしない）
  { kind: "check_area", label: "地域の状況を確認する", description: "今朝の地図と雪解けの進みを見る", minutes: 3, onsite: false, difficulty: 1, feathers: 2, photo: "none" },
  { kind: "report_online", label: "雪の状況を報告する", description: "家の前の雪を一言で知らせる", minutes: 3, onsite: false, difficulty: 1, feathers: 2, photo: "none" },
  { kind: "find_online", label: "助けが必要な場所を発見する", description: "あと1人で救える家がないか見る", minutes: 3, onsite: false, difficulty: 1, feathers: 2, photo: "none" },
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
  return soloMission(kind)?.label ?? SOLO_BONUS[kind as SoloBonusKind]?.label ?? kind;
}

/** チームに入る点の目安（spec v1.7）。家の手伝いは朝の一本道で数えるので null */
export function soloTeamPoints(m: Pick<SoloMission, "kind" | "onsite">): number | null {
  if (m.kind === "help_house") return null;
  if (!m.onsite) return 1;
  return m.kind === "own_house" ? 5 : 3;
}
