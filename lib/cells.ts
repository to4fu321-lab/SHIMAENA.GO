// 50m マス。拠点の位置（50m 単位に丸めた点）をマスの中心として、地図はマスを塗る。
// どの家かは特定できない大きさにしてある（札幌の住宅の間口は 15〜20m ほど）。
import type { Roster } from "./morning/roster";
import type { BaseView } from "./morning/view";
import { TOWN } from "./town";
import type { LatLng, TeamId } from "./types";

export const CELL_M = 50;
const M_PER_LAT = 111320;
const M_PER_LNG = 111320 * Math.cos((TOWN.center[0] * Math.PI) / 180);

export function cellKey(p: LatLng): string {
  const row = Math.round(((p[0] - TOWN.center[0]) * M_PER_LAT) / CELL_M);
  const col = Math.round(((p[1] - TOWN.center[1]) * M_PER_LNG) / CELL_M);
  return `${row},${col}`;
}

export function cellCenter(key: string): LatLng {
  const [row, col] = key.split(",").map(Number);
  return [TOWN.center[0] + (row * CELL_M) / M_PER_LAT, TOWN.center[1] + (col * CELL_M) / M_PER_LNG];
}

export function cellPolygon(key: string): LatLng[] {
  const [lat, lng] = cellCenter(key);
  const dLat = CELL_M / 2 / M_PER_LAT;
  const dLng = CELL_M / 2 / M_PER_LNG;
  return [
    [lat - dLat, lng - dLng],
    [lat - dLat, lng + dLng],
    [lat + dLat, lng + dLng],
    [lat + dLat, lng - dLng],
  ];
}

export type CellStatus = "short" | "no_answer" | "in_progress" | "assigned" | "open" | "done" | "none";

export interface CellView {
  key: string;
  baseNumbers: number[];
  /** マスの中でいちばん目立たせるべき状態 */
  status: CellStatus;
  /** 完了・作業に関わったチーム（来た順） */
  teams: TeamId[];
  /** ミッションのうち完了した割合（0〜1） */
  doneRatio: number;
}

// 助けが要る状態を優先して見せる
const PRIORITY: CellStatus[] = ["short", "no_answer", "in_progress", "assigned", "open", "done", "none"];

/**
 * 拠点ごとの見え方を、50m マスごとにまとめる。
 * 名簿には家の正確な位置が入っているので、これはサーバー側で呼び、画面にはマスだけを渡す。
 */
export function viewCells(views: BaseView[], roster: Roster): CellView[] {
  const byBase = new Map(views.map((v) => [v.baseId, v]));
  const cells = new Map<string, { numbers: number[]; views: (BaseView | undefined)[] }>();
  for (const base of roster.bases) {
    const requester = roster.participants.find((p) => p.id === base.requesterId);
    if (!requester) continue;
    const key = cellKey(requester.location);
    const cell = cells.get(key) ?? { numbers: [], views: [] };
    cell.numbers.push(base.number);
    cell.views.push(byBase.get(base.id));
    cells.set(key, cell);
  }
  return [...cells.entries()].map(([key, c]) => {
    const statuses = c.views.map((v) => (v ? v.status : "none") as CellStatus);
    const missions = c.views.filter((v) => v && v.status !== "none");
    const done = missions.filter((v) => v!.status === "done").length;
    const teams: TeamId[] = [];
    for (const v of c.views) for (const t of v?.teams ?? []) if (!teams.includes(t)) teams.push(t);
    const active: CellStatus[] = statuses.filter((s) => s !== "done" && s !== "none");
    const status: CellStatus =
      active.length > 0
        ? PRIORITY.find((p) => active.includes(p))!
        : done > 0
          ? "done"
          : "none";
    return { key, baseNumbers: c.numbers.sort((a, b) => a - b), status, teams, doneRatio: missions.length ? done / missions.length : 0 };
  });
}
