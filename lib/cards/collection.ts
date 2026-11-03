// 図鑑（spec v1.2 7）: 5つのタッチの取得状況と、リボン（初出撃・早朝・混成・大雪・五日連続）。個人順位は出さない。
import type { Card, CardStyle } from "../types";
import { BIG_SNOW_CM, STYLE_NAME } from "./rarity";

export interface StyleEntry {
  style: CardStyle;
  name: string;
  /** 手に入れる条件（やさしい言葉で） */
  hint: string;
  got: boolean;
  count: number;
}

export interface RibbonEntry {
  key: "first" | "early" | "mixed" | "bigsnow" | "streak";
  label: string;
  hint: string;
  got: boolean;
}

export interface Collection {
  styles: StyleEntry[];
  ribbons: RibbonEntry[];
  total: number;
}

const HINT: Record<CardStyle, string> = {
  kawaii: "雪の朝に1軒終える",
  retrowave: "7:30 までに終える",
  kirie: `${BIG_SNOW_CM}cm 以上の大雪の朝`,
  pixel: "5日連続で出撃",
  eijin: "2チームで同じ家に",
};

const ORDER: CardStyle[] = ["kawaii", "retrowave", "eijin", "kirie", "pixel"];

export function collection(cards: Card[]): Collection {
  const byStyle = new Map<CardStyle, number>();
  for (const c of cards) byStyle.set(c.style, (byStyle.get(c.style) ?? 0) + 1);
  const styles = ORDER.map((style) => ({
    style,
    name: STYLE_NAME[style],
    hint: HINT[style],
    got: (byStyle.get(style) ?? 0) > 0,
    count: byStyle.get(style) ?? 0,
  }));
  const ribbons: RibbonEntry[] = [
    { key: "first", label: "初出撃", hint: "最初の1枚", got: cards.length > 0 },
    { key: "early", label: "早朝の群れ", hint: "7:30 までに完了", got: cards.some((c) => c.style === "retrowave") },
    { key: "mixed", label: "混成の群れ", hint: "2チームで合流", got: cards.some((c) => c.teamIds.length >= 2) },
    { key: "bigsnow", label: "大雪の群れ", hint: `${BIG_SNOW_CM}cm 以上`, got: cards.some((c) => c.style === "kirie") },
    { key: "streak", label: "五日連続の群れ", hint: "5日連続", got: cards.some((c) => c.style === "pixel") },
  ];
  return { styles, ribbons, total: cards.length };
}

/** ご褒美（想定）: 枚数で町内会から。デモは架空。実在の店ではない */
export const REWARDS = [
  { at: 10, label: "銭湯券", from: "架空の銭湯「しらかば湯」" },
  { at: 20, label: "あったかい一杯", from: "架空の町内のお店" },
  { at: 30, label: "春の感謝状", from: "町内会（架空）" },
] as const;

export function nextReward(total: number): { at: number; label: string; from: string; left: number } | null {
  const r = REWARDS.find((x) => total < x.at);
  return r ? { ...r, left: r.at - total } : null;
}
