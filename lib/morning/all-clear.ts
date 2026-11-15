// 「全軒 完了！」のお祝い（spec v1.66）: 今朝の家がすべて終わった瞬間に、参加した人みんなが見る画面と通知の材料。
// 数字はここでプログラムが数える（AI に作らせない）。純粋な関数だけ。
import type { MorningState } from "./view";
import { progress } from "./view";

/** 通知・隊長トークのボタンが開く先（地図の上にお祝いの画面が出る） */
export const ALL_CLEAR_PATH = "/map?fin=1";

export interface AllClearStats {
  /** 今朝の家の数（すべて完了） */
  houses: number;
  /** 雪かきに行った人の数 */
  people: number;
  /** 出たチームの数 */
  teams: number;
  /** どけた雪（kg。分かる家の合計。0 なら出さない） */
  snowKg: number;
  snowName?: string;
  /** 最後の家が終わった時刻（HH:mm） */
  at?: string;
}

/** 今朝、雪かきを終えた人（完了した出動がある人）の ID。重なりなし */
export function allClearMembers(state: MorningState): string[] {
  return [...new Set(state.sorties.filter((s) => s.status === "done").map((s) => s.participantId))];
}

/** すべて完了していれば、お祝いの数字。まだなら null */
export function allClearStats(state: MorningState): AllClearStats | null {
  const prog = progress(state);
  if (!prog.allDone || prog.total === 0) return null;
  const done = state.sorties.filter((s) => s.status === "done");
  return {
    houses: prog.total,
    people: new Set(done.map((s) => s.participantId)).size,
    teams: new Set(done.map((s) => s.teamId)).size,
    snowKg: Math.round(state.missions.reduce((a, m) => a + (m.snowKg ?? 0), 0)),
    snowName: state.rollcall.snowName,
    at: prog.defeatedAt,
  };
}

/** 数字の1行（画面・通知・声で同じ言い方） */
export function allClearLine(s: AllClearStats): string {
  return `${s.people}人${s.teams > 1 ? `・${s.teams}チーム` : ""}で、${s.houses}軒すべてに灯りがともりました。`;
}

/** 最初の一言（いつも同じ文。声は文ごとに作って残すので、2回目からすぐ鳴る） */
export const ALL_CLEAR_VOICE_HEAD = "やったー！全軒完了だしま〜！";

/** シマエナ隊長が声で言う文 */
export function allClearVoiceText(s: AllClearStats): string {
  return [ALL_CLEAR_VOICE_HEAD, s.snowName ? `今朝の雪、${s.snowName}を、みんなでやっつけました。` : "", allClearLine(s), "みなさん、ほんとうにおつかれさまでした。"].join("");
}
