// ことばで頼まれた段取りの表示（spec v1.6）。画面（クライアント）からも使うので、Claude の部品とは分けておく。
import type { RequestNote } from "./types";

export const AREA_LABEL: Record<NonNullable<RequestNote["area"]>, string> = { entrance: "玄関前", garage: "車庫前", road: "道路まで" };

/** 「9:00 まで・玄関前」。何もなければ空 */
export function requestLabel(r?: RequestNote): string {
  if (!r) return "";
  return [r.deadline && `${r.deadline} まで`, r.area && AREA_LABEL[r.area]].filter(Boolean).join("・");
}
