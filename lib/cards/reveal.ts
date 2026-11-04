// 完了画面の「カード発行」の演出に渡す情報（画面側でも読める、サーバー専用のものを含まない形）。
import type { CardStyle } from "../types";

/** 消印の色（lib/cards/svg.ts の各タッチと同じ） */
export const STAMP_COLOR: Record<CardStyle, { ink: string; paper: string }> = {
  kawaii: { ink: "#d81b60", paper: "#fff6fb" },
  retrowave: { ink: "#2ee6ff", paper: "#140a2e" },
  kirie: { ink: "#b3261e", paper: "#f4efe6" },
  pixel: { ink: "#ff6b9d", paper: "#0e1430" },
  eijin: { ink: "#e81e3c", paper: "#fffdf6" },
};

export interface RevealCard {
  id: string;
  designName: string;
  style: CardStyle;
  serial: number;
  issuedCount: number;
  townName: string;
  date: string; // YYYY-MM-DD
  /** 消印の真ん中（排雪 kg・「ソロ」） */
  stampText: string;
  /** この時だけの設計図の番号（あれば） */
  code?: string;
}
