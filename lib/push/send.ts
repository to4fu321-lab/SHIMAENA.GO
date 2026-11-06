// 端末への通知を送る（Web Push、spec v1.17）。鍵がない・/admin/settings で一時停止 のときは送らない（隊長トークには残っている）。
// 届かなくなった端末（410/404）は購読を消す。失敗は例外にせず、/admin の「問題」に残す。
import webpush from "web-push";
import { buildNotice, type Notice, type PushPayload } from "./notice";
import type { LineMessage } from "../line/types";
import { recordProblem } from "../ops/problems";
import { loadSettings } from "../ops/settings";
import { baseUrl } from "../url";
import { hasPushKeys } from "./keys";
import { listSubscriptions, removeSubscription } from "./store";

export type { PushPayload } from "./notice";

/** 文面から通知の中身（前の版の名前。中身は lib/push/notice.ts の buildNotice） */
export function pushPayload(messages: LineMessage[], now = new Date()): PushPayload {
  return buildNotice(messages, now).payload;
}

let configured = false;
function configure(): boolean {
  if (!hasPushKeys()) return false;
  if (!configured) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT?.trim() || baseUrl(), process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    configured = true;
  }
  return true;
}

/** その鍵の人の全端末へ。送れた端末の数を返す（鍵なし・一時停止・購読なしは 0） */
export async function sendPush(key: string, payload: PushPayload, opts: Pick<Notice, "urgency" | "ttl"> = { urgency: "normal", ttl: 6 * 3600 }): Promise<number> {
  if (!configure()) return 0;
  if ((await loadSettings()).linePaused) return 0;
  const subs = await listSubscriptions(key).catch(() => []);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: opts.ttl, urgency: opts.urgency });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await removeSubscription(s.endpoint).catch(() => undefined); // もう届かない端末
      else await recordProblem("push/send", e);
    }
  }
  return sent;
}
