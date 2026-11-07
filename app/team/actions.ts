"use server";

// チームで時間をそろえる（spec v1.41 ②）: 帯を選ぶ（選び直せる）。そろう時間が変わったら、隊長の一文を書き直して残す。
import { revalidatePath } from "next/cache";
import { bestSlot, countSlots, isSlot, putWish, slotOpen } from "@/lib/calendar/slots";
import { timeActive, wishesFor } from "@/lib/calendar/team-time";
import { slotLine } from "@/lib/claude/slot";
import { demoEnabled } from "@/lib/env";
import { jstDate, jstMinutes } from "@/lib/jst";
import { onTeam } from "@/lib/member";
import { loadRoster } from "@/lib/morning/roster";
import { loadMorning, saveMorning } from "@/lib/morning/store";
import { withStateLock } from "@/lib/ops/lock";
import { getTeam } from "@/lib/teams";
import { trustedViewer } from "@/lib/viewer";

export interface TimeResult {
  ok: boolean;
  text: string;
}

export async function chooseTimeAction(viewerId: string, when: string): Promise<TimeResult> {
  if (!isSlot(when)) return { ok: false, text: "時間を選び直してください。" };
  const id = await trustedViewer(viewerId);
  if (!id) return { ok: false, text: "この画面の持ち主を確かめられませんでした。ログインし直してください。" };
  const roster = await loadRoster();
  const me = roster.participants.find((p) => p.id === id);
  if (!me || !onTeam(me) || !me.teamId) return { ok: false, text: "チームに入っている人が選べます。" };
  const teamId = me.teamId;
  const mateIds = roster.participants.filter((p) => onTeam(p) && p.teamId === teamId).map((p) => p.id);
  const demo = demoEnabled();

  // 1) 選びを残す。そろう時間と人数を数える
  const now = new Date();
  const saved = await withStateLock("team:chooseTime", async () => {
    const s = await loadMorning();
    if (!timeActive(s, now)) return { error: "いまは雪の日ではないので、時間は選べません。雪の予告が出たら選べます。" } as const;
    const open = (w: typeof when) => slotOpen(w, s.morning.rollcall.date, jstDate(now), jstMinutes(now));
    if (!open(when)) return { error: "その時間はもう過ぎました。ほかの時間を選んでください。" } as const;
    s.timeWishes = putWish(s.timeWishes, { participantId: id, when, at: now.toISOString() });
    await saveMorning(s);
    const counts = countSlots(wishesFor(s, roster, undefined, demo), mateIds, open);
    const best = bestSlot(counts);
    const line = s.slotLines?.[teamId];
    return { best, count: best ? counts[best] : 0, fresh: Boolean(best && (!line || line.when !== best || line.count !== counts[best])) } as const;
  });
  if ("error" in saved) return { ok: false, text: saved.error ?? "" };

  // 2) そろう時間が変わったら、隊長の一文を書き直す（Claude はロックの外で。失敗しても決まった文が出る）
  if (saved.fresh && saved.best) {
    const best = saved.best;
    const text = await slotLine({ teamName: getTeam(teamId).name, when: best, count: saved.count });
    await withStateLock("team:slotLine", async () => {
      const s = await loadMorning();
      s.slotLines = { ...(s.slotLines ?? {}), [teamId]: { when: best, count: saved.count, text } };
      await saveMorning(s);
    });
  }
  revalidatePath("/team");
  return { ok: true, text: "選びました。" };
}
