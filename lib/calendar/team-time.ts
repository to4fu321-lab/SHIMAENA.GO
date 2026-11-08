// チームで時間をそろえる（spec v1.41 ②）の画面に出すもの。朝の記録と名簿から組み立てる（保存しない）。
import { onTeam } from "../member";
import { dayDiff } from "../morning/today";
import { jstDate, jstMinutes } from "../jst";
import { getTeam } from "../teams";
import type { MorningRecord } from "../morning/flow";
import type { Roster } from "../morning/roster";
import type { HelperWhen, Participant, TeamId } from "../types";
import { bestSlot, countSlots, demoWish, SLOTS, slotOpen, templateSlotLine, type TimeWish } from "./slots";

export interface TeamTimeView {
  /** 時間を選べる日か（前夜の予告のあと〜その日の 19 時） */
  active: boolean;
  date: string;
  /** 「今日」「明日」「12月9日」 */
  dayLabel: string;
  teamId: TeamId;
  teamName: string;
  slots: { id: HelperWhen; label: string; range: string; meet: string; open: boolean; count: number; ids: string[] }[];
  best?: HelperWhen;
  mine?: HelperWhen;
  line?: string;
}

/** 選べる日か。デモの世界（本当の日付から離れた朝）は、点呼が閉じていなければ選べる */
export function timeActive(record: Pick<MorningRecord, "morning">, now: Date = new Date()): boolean {
  const rc = record.morning.rollcall;
  if (rc.status === "closed") return false;
  const real = jstDate(now);
  const diff = dayDiff(rc.date, real);
  return Math.abs(diff) > 1 || diff >= 0;
}

/** 数える選び: 保存した選び＋（デモなら）架空の手伝う人の決まった選び。見ている本人には足さない */
export function wishesFor(record: Pick<MorningRecord, "timeWishes">, roster: Roster, viewerId: string | undefined, demo: boolean): TimeWish[] {
  const saved = record.timeWishes ?? [];
  if (!demo) return saved;
  const has = new Set(saved.map((w) => w.participantId));
  const fake = roster.participants
    .filter((p) => p.role === "helper" && !p.lineUserId && /^h\d+$/.test(p.id) && p.id !== viewerId && !has.has(p.id))
    .map((p) => ({ participantId: p.id, when: demoWish(p.id), at: "" }));
  return [...saved, ...fake];
}

export function teamTimeView(
  record: MorningRecord,
  roster: Roster,
  me: Participant,
  opts: { demo: boolean; now?: Date },
): TeamTimeView | undefined {
  if (!me.teamId) return undefined;
  const now = opts.now ?? new Date();
  const rc = record.morning.rollcall;
  const real = jstDate(now);
  const nowMin = jstMinutes(now);
  const team = getTeam(me.teamId);
  const mates = roster.participants.filter((p) => onTeam(p) && p.teamId === me.teamId);
  const mateIds = new Set(mates.map((p) => p.id));
  const wishes = wishesFor(record, roster, me.id, opts.demo).filter((w) => mateIds.has(w.participantId));
  const open = (id: HelperWhen) => slotOpen(id, rc.date, real, nowMin);
  const counts = countSlots(wishes, mateIds, open);
  const best = bestSlot(counts);
  const mine = (record.timeWishes ?? []).find((w) => w.participantId === me.id)?.when;
  const diff = dayDiff(rc.date, real);
  const dayLabel = Math.abs(diff) > 1 || diff === 0 ? "今日" : diff === 1 ? "明日" : `${Number(rc.date.slice(5, 7))}月${Number(rc.date.slice(8, 10))}日`;
  const saved = record.slotLines?.[me.teamId];
  const line = best ? (saved && saved.when === best && saved.count === counts[best] ? saved.text : templateSlotLine(team.name, best, counts[best])) : undefined;
  return {
    active: timeActive(record, now),
    date: rc.date,
    dayLabel,
    teamId: me.teamId,
    teamName: team.name,
    slots: SLOTS.map((s) => ({
      id: s.id,
      label: s.label,
      range: s.range,
      meet: s.meet,
      open: open(s.id),
      count: counts[s.id],
      ids: wishes.filter((w) => w.when === s.id && open(w.when)).map((w) => w.participantId),
    })),
    best,
    mine,
    line,
  };
}
