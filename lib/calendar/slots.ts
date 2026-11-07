// チームで時間をそろえる（spec v1.41 ②）。純粋な関数だけ（保存・画面・Claude は別のファイル）。
// そろう時間はプログラムが決める（AI の基準）: 同じチームで選んだ人がいちばん多い帯。同じ数なら早いほう。
import type { HelperWhen, TeamId } from "../types";

/** 選べる帯（v1.8 の朝・お昼・夕方）。meet = チームで集まる時刻（予定の始まり） */
export const SLOTS: readonly { id: HelperWhen; label: string; range: string; meet: string; endMin: number }[] = [
  { id: "am", label: "朝", range: "6〜9時", meet: "07:00", endMin: 9 * 60 },
  { id: "noon", label: "お昼", range: "11〜13時", meet: "11:30", endMin: 13 * 60 },
  { id: "pm", label: "夕方", range: "16〜19時", meet: "16:30", endMin: 19 * 60 },
];

/** 予定の長さ（分） */
export const MEET_MINUTES = 30;
/** 帯の終わりのこの分数前を過ぎたら、その日はもう選べない */
const CLOSE_BEFORE_END = 30;

export interface TimeWish {
  participantId: string;
  when: HelperWhen;
  at: string; // ISO
}

export function isSlot(v: unknown): v is HelperWhen {
  return SLOTS.some((s) => s.id === v);
}

export function slotOf(id: HelperWhen) {
  return SLOTS.find((s) => s.id === id)!;
}

/**
 * その帯をまだ選べるか。date が本当の今日なら、終わりの 30 分前まで。明日以降（前夜の予告）はどれでも。
 * 過ぎた日・デモの世界（本当の日付から離れた日）は、帯で締めない（デモの朝はいつ見ても同じに見せる）。
 */
export function slotOpen(id: HelperWhen, date: string, realToday: string, nowMin: number): boolean {
  if (date !== realToday) return true;
  return nowMin < slotOf(id).endMin - CLOSE_BEFORE_END;
}

/** 同じ人の前の選びは置き換える（選び直せる） */
export function putWish(wishes: TimeWish[] | undefined, w: TimeWish): TimeWish[] {
  return [...(wishes ?? []).filter((x) => x.participantId !== w.participantId), w];
}

/** チームのなかま（memberIds）が帯ごとに何人。選べない帯は数えない */
export function countSlots(wishes: TimeWish[], memberIds: Iterable<string>, open: (id: HelperWhen) => boolean = () => true): Record<HelperWhen, number> {
  const ids = new Set(memberIds);
  const out: Record<HelperWhen, number> = { am: 0, noon: 0, pm: 0 };
  for (const w of wishes) if (ids.has(w.participantId) && open(w.when)) out[w.when]++;
  return out;
}

/** そろう時間: いちばん多い帯。同じ数なら早いほう。まだ誰も選んでいなければ undefined */
export function bestSlot(counts: Record<HelperWhen, number>): HelperWhen | undefined {
  let best: HelperWhen | undefined;
  for (const s of SLOTS) if (counts[s.id] > 0 && (!best || counts[s.id] > counts[best])) best = s.id;
  return best;
}

/** 隊長のことばの決まった文（キーがない・点検に通らないとき） */
export function templateSlotLine(teamName: string, id: HelperWhen, count: number): string {
  const s = slotOf(id);
  return `${teamName}は${s.label} ${Number(s.meet.slice(0, 2))}:${s.meet.slice(3)}〜に${count}人。一緒にそろえませんか？`;
}

/** 隊長のことばに使ってよい数字（人数・集まる時刻の時と分） */
export function slotLineNumbers(id: HelperWhen, count: number): number[] {
  const m = slotOf(id).meet;
  return [count, Number(m.slice(0, 2)), Number(m.slice(3))];
}

/**
 * デモの架空の手伝う人（DEMO_MODE、h1…）が選んだことにする帯。決まった種なので、いつ見ても同じ。
 * 朝が多め（6割）・お昼 3割・夕方 1割。
 */
export function demoWish(participantId: string): HelperWhen {
  let h = 2166136261;
  for (const c of participantId) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const r = (h % 100) / 100;
  return r < 0.6 ? "am" : r < 0.9 ? "noon" : "pm";
}

/** チームごとの隊長のことば（朝の記録に残す。みんなで使い回す） */
export type SlotLines = Partial<Record<TeamId, { when: HelperWhen; count: number; text: string }>>;
