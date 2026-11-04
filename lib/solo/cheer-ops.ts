// 自宅の雪かきへの応援・おつかれさま（11/4）の「本番の操作」: 読み込み・保存・チームの点。
import { POINTS } from "../game/score";
import { loadMorning, saveMorning } from "../morning/store";
import { appToday } from "../morning/today";
import { repo } from "../repo";
import type { ScoreEvent } from "../types";
import { cheerNews, markSeen, notYetSent, sendCheers, type CheerKind, type CheerNews } from "./home-cheer";
import { homeNowIds } from "./home-now";
import { addSoloScores } from "./team-points";

export interface CheerTargets {
  /** いま自宅を雪かき中（自分以外） */
  working: string[];
  /** 今日 自宅を終えた人（自分以外） */
  finished: string[];
}

/** 送る相手（自分以外）。終えた人は、今日のソロの台帳の「自分の家の雪かき」から */
export async function cheerTargets(me: string | undefined, now: Date): Promise<CheerTargets> {
  const record = await loadMorning();
  const date = appToday(record, now);
  const logs = await repo().listSoloLogsBetween(date, date).catch(() => []);
  const finished = [...new Set(logs.filter((l) => l.kind === "own_house").map((l) => l.participantId))];
  const working = homeNowIds(record, now);
  return { working: working.filter((id) => id !== me), finished: finished.filter((id) => id !== me && !working.includes(id)) };
}

/** まだ送っていない相手の数（ボタンに出す） */
export async function cheerButtons(me: string, now: Date): Promise<{ cheer: number; thanks: number; working: number; finished: number }> {
  const record = await loadMorning();
  const date = appToday(record, now);
  const t = await cheerTargets(me, now);
  return {
    cheer: notYetSent(record, date, me, "cheer", t.working).length,
    thanks: notYetSent(record, date, me, "thanks", t.finished).length,
    working: t.working.length,
    finished: t.finished.length,
  };
}

/** 応援（いま雪かき中の人みんな）・おつかれさま（今日終えた人みんな）を送る。届いた人数を返す */
export async function sendHomeCheer(from: string, kind: CheerKind, now: Date): Promise<number> {
  const me = await repo().findParticipant(from);
  if (!me) return 0;
  const t = await cheerTargets(from, now);
  const record = await loadMorning();
  const date = appToday(record, now);
  const r = sendCheers(record, date, from, kind, kind === "cheer" ? t.working : t.finished);
  if (r.sent === 0) return 0;
  await saveMorning(record);
  // 10人分で、受け取った人のチームに +1点（チームのない人には付けない）
  const events: ScoreEvent[] = [];
  for (const id of r.pointTo) {
    const p = await repo().findParticipant(id);
    if (!p?.teamId) continue;
    events.push({ id: `hc${now.getTime().toString(36)}${id}`, teamId: p.teamId, participantId: p.id, points: POINTS.home_cheer, reason: "home_cheer", at: now.toISOString() });
  }
  await addSoloScores(record, date, events);
  return r.sent;
}

/** 本人がまだ聞いていない応援（ホームで隊長が飛んできて話す） */
export async function myCheerNews(id: string, now: Date): Promise<CheerNews | undefined> {
  const record = await loadMorning();
  return cheerNews(record, appToday(record, now), id);
}

export async function markCheersSeen(id: string, now: Date): Promise<void> {
  const record = await loadMorning();
  if (markSeen(record, appToday(record, now), id)) await saveMorning(record);
}
