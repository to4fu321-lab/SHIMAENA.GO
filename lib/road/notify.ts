// 道の報告を、近く（家から 300m）の「受け取る」にした人へ LINE で知らせる。1人1日3回まで。
// 同じ場所・同じ種類（50m・2時間以内）はまとめて1回。夜（19〜6時）は送らず、朝の定時処理でまとめて送る。
import { repo } from "../repo";
import { inboxKeyOf } from "../inbox/key";
import { push } from "../line/client";
import { MSG } from "../line/messages";
import { isNight } from "../night";
import { jstDate } from "../jst";
import { baseUrl } from "../url";
import { agoText, alreadyAlerted, hazard, pickRecipients, type RoadReport } from "./hazards";
import { addSend, listAlertOn, listRoadReportsSince, markNotified, sendCounts } from "./store";

/** 1件を知らせる。送った人数を返す（夜は 0 のまま、あとで flushRoadAlerts が送る） */
export async function notifyRoadReport(r: RoadReport, now: Date = new Date()): Promise<number> {
  if (isNight(now) || r.notifiedAt) return 0;
  const h = hazard(r.hazard);
  if (!h) return 0;
  const recent = await listRoadReportsSince(new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString());
  const at = now.toISOString();
  if (alreadyAlerted(r, recent)) {
    await markNotified(r.id, at); // 同じ場所はもう知らせてある
    return 0;
  }
  const date = jstDate(now);
  const [people, on, counts] = await Promise.all([repo().listParticipants(), listAlertOn(), sendCounts(date)]);
  const to = pickRecipients(
    r,
    people.map((p) => ({ participantId: p.id, lineUserId: inboxKeyOf(p), home: p.location, enabled: on.has(p.id), sentToday: counts.get(p.id) ?? 0 })),
  );
  const photoUrl = baseUrl().startsWith("https://") ? `${baseUrl()}/api/road/${r.id}/photo` : undefined;
  let sent = 0;
  for (const t of to) {
    const ok = await push(t.lineUserId, MSG.roadAlert({ ...h, distance: t.distance, ago: agoText(r.at, now), photoUrl, reportId: r.id }));
    if (ok) {
      await addSend(t.participantId, date);
      sent++;
    }
  }
  await markNotified(r.id, at);
  return sent;
}

/** 夜のあいだに届いた報告を、朝にまとめて知らせる（12時間以内のもの） */
export async function flushRoadAlerts(now: Date = new Date()): Promise<number> {
  if (isNight(now)) return 0;
  const pending = (await listRoadReportsSince(new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString())).filter((r) => !r.notifiedAt).reverse();
  let sent = 0;
  for (const r of pending) sent += await notifyRoadReport(r, now);
  return sent;
}
