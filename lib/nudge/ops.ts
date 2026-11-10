// 隊長の声かけ（spec v1.18）の本番の操作: 対象を選び、文を書き、隊長トークに入れる（通知つき）。
// 16:30 の出番の処理（cron pm）と /admin のボタンから。警報の日・夜は呼ばない（呼ぶ側で止める）。
import { nudgeLines } from "../claude/nudge";
import { conciergeContext } from "../concierge/run";
import { conciergePick } from "../concierge/messages";
import { buildOptions } from "../concierge/options";
import { loadProfile } from "../concierge/profile";
import { inboxKeyOf } from "../inbox/key";
import { listThread } from "../inbox/store";
import { push } from "../line/client";
import { youImagePath } from "../line/you-image";
import { onTeam } from "../member";
import { loadRoster } from "../morning/roster";
import { listMornings, loadMorning } from "../morning/store";
import { appToday } from "../morning/today";
import { weekStart } from "../game/week";
import { repo } from "../repo";
import { getTeam } from "../teams";
import { baseUrl } from "../url";
import { isClockNight } from "../night";
import { loadNudge, saveNudge } from "./store";
import { shouldNudge, type NudgeCandidate } from "./rules";
import type { Participant } from "../types";

/** その人の最後の活動（ソロ・家の手伝い・カード・隊長トークで送った文）。なければ undefined */
export async function lastActivityOf(p: Participant): Promise<string | undefined> {
  const r = repo();
  const [logs, cards] = await Promise.all([r.listSoloLogsByParticipant(p.id).catch(() => []), r.listCardsByRecipient(p.id).catch(() => [])]);
  const key = inboxKeyOf(p);
  const thread = key ? await listThread(key).catch(() => []) : [];
  const times = [...logs.map((l) => l.at), ...cards.map((c) => c.createdAt), ...thread.filter((x) => x.dir === "in").map((x) => x.at)];
  return times.length ? times.sort().at(-1) : undefined;
}

export interface NudgeResult {
  checked: number;
  sent: number;
  names: string[];
}

/** しばらく活動のない手伝う側に声をかける */
export async function nudgeInactive(now = new Date()): Promise<NudgeResult> {
  if (isClockNight(now)) return { checked: 0, sent: 0, names: [] };
  const roster = await loadRoster();
  const record = await loadMorning();
  const today = appToday(record, now);
  const from = weekStart(today);
  const mornings = await listMornings(from, today).catch(() => []);
  const week = { days: mornings.length, housesDone: mornings.reduce((a, m) => a + m.morning.missions.filter((x) => x.status === "done").length, 0) };
  const result: NudgeResult = { checked: 0, sent: 0, names: [] };
  for (const p of roster.participants) {
    if (p.role !== "helper") continue;
    const key = inboxKeyOf(p);
    if (!key) continue;
    result.checked++;
    const state = (await loadNudge(p.id).catch(() => undefined)) ?? { firstSeen: now.toISOString() };
    const lastActiveAt = await lastActivityOf(p);
    const c: NudgeCandidate = { id: p.id, role: "helper", ...(lastActiveAt ? { lastActiveAt } : {}) };
    if (!(await loadNudge(p.id).catch(() => undefined))) await saveNudge(p.id, state); // 初めて見た時刻を残す
    if (!shouldNudge(c, state, now)) continue;
    // 候補: コンシェルジュと同じ（点呼・行き先は除く）。方向に合うものが前に来る
    const ctx = await conciergeContext(p, record, now);
    const option = buildOptions(ctx).find((o) => o.id !== "rollcall" && o.id !== "my_mission");
    if (!option) continue;
    const profile = await loadProfile(p.id).catch(() => undefined);
    const [logs, cards] = await Promise.all([repo().listSoloLogsByParticipant(p.id).catch(() => []), repo().listCardsByRecipient(p.id).catch(() => [])]);
    const lines = await nudgeLines({
      nickname: p.nickname,
      daysSince: lastActiveAt ? Math.floor((now.getTime() - Date.parse(lastActiveAt)) / 86400000) : null,
      motives: profile?.motives ?? [],
      summary: profile?.summary ?? "",
      feathers: logs.reduce((a, l) => a + l.feathers, 0),
      cards: cards.length,
      teamName: onTeam(p) && p.teamId ? getTeam(p.teamId).name : undefined,
      week,
      option: { title: option.title, minutes: option.minutes, points: option.points },
    });
    const img = youImagePath({ sky: "morning", prop: option.prop, caption: "雪の便りだしま〜", title: option.title, minutes: option.minutes, points: option.points, teamId: onTeam(p) ? p.teamId : undefined });
    const ok = await push(key, conciergePick(lines.join(""), option, `${baseUrl()}${img}`));
    if (ok) {
      result.sent++;
      result.names.push(p.nickname);
      await saveNudge(p.id, { ...state, lastAt: now.toISOString(), ...(lastActiveAt ? { activeAtLast: lastActiveAt } : {}) });
    }
  }
  return result;
}
