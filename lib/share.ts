// 絵文字グリッド（spec v1.1）: マスの色だけで今朝の結果を文字にする。Wordle 式。
// 氏名も家も出ない（マスの並びと色だけ）ので、LINE グループや X にそのまま貼れる。チーム順位は出さない。
import type { CellView } from "./cells";
import { type MorningState, progress } from "./morning/view";
import { TOWN } from "./town";
import type { TeamId } from "./types";

const SQUARE: Record<TeamId, string> = { salvia: "🟦", marigold: "🟧", lupinus: "🟪" };

/** マス1つの絵文字: 完了＝チーム色／人手不足＝赤／返事なし＝黒／まだ＝白／今朝は出番なし＝小さい白 */
export function cellEmoji(cell: CellView): string {
  switch (cell.status) {
    case "done":
      return SQUARE[cell.teams[0]] ?? "🟦";
    case "short":
      return "🟥";
    case "no_answer":
      return "⬛";
    case "none":
      return "◽";
    default:
      return "⬜";
  }
}

/** マスを北から南へ、西から東へ並べる（行ごとに1行） */
export function gridLines(cells: CellView[]): string[] {
  const rows = new Map<number, { col: number; emoji: string }[]>();
  for (const c of cells) {
    const [row, col] = c.key.split(",").map(Number);
    rows.set(row, [...(rows.get(row) ?? []), { col, emoji: cellEmoji(c) }]);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, list]) => list.sort((a, b) => a.col - b.col).map((x) => x.emoji).join(""));
}

/** 2チーム以上が合流して終えた家の数 */
export function mixedCount(state: MorningState): number {
  const teams = new Map<string, Set<TeamId>>();
  for (const s of state.sorties) teams.set(s.missionId, new Set([...(teams.get(s.missionId) ?? []), s.teamId]));
  return state.missions.filter((m) => m.status === "done" && (teams.get(m.id)?.size ?? 0) >= 2).length;
}

/**
 * 共有用の文字（3行＋タグ）。例:
 *   シマエナGO しらかば町内 12/14 雪12cm『ぼた雪のドンブリ』
 *   ⬜🟦🟧🟪
 *   🟦⬜🟪🟧
 *   7/7軒 7:52 討伐 ・ 混成2
 *   #シマエナGO
 */
export function emojiGrid(cells: CellView[], state: MorningState): string {
  const [, month, day] = state.rollcall.date.split("-").map(Number);
  const prog = progress(state);
  const mixed = mixedCount(state);
  const head = `シマエナGO ${TOWN.name.replace(/（.*）$/, "")} ${month}/${day} 雪${state.rollcall.forecastCm}cm${state.rollcall.snowName ? `『${state.rollcall.snowName}』` : ""}`;
  const result =
    prog.total === 0
      ? "作戦はこれから"
      : prog.allDone
        ? `${prog.done}/${prog.total}軒 ${prog.defeatedAt ? `${prog.defeatedAt} ` : ""}討伐`
        : `${prog.done}/${prog.total}軒 あと${prog.left}軒`;
  const foot = `${result}${mixed > 0 ? ` ・ 混成${mixed}` : ""}`;
  return [head, ...gridLines(cells), foot, "#シマエナGO"].join("\n");
}
