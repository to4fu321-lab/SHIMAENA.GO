// 端末への通知を送る（Web Push、spec v1.17）。鍵がない・/admin/settings で一時停止 のときは送らない（隊長トークには残っている）。
// 届かなくなった端末（410/404）は購読を消す。失敗は例外にせず、/admin の「問題」に残す。
import webpush from "web-push";
import { textOf } from "../line/flex";
import type { LineMessage } from "../line/types";
import { recordProblem } from "../ops/problems";
import { loadSettings } from "../ops/settings";
import { baseUrl } from "../url";
import { hasPushKeys } from "./keys";
import { listSubscriptions, removeSubscription } from "./store";

export interface PushPayload {
  title: string;
  body: string;
  /** 押したときに開く道（アプリの中） */
  url: string;
  /** 同じ tag の通知は1つにまとまる */
  tag?: string;
}

export const BODY_MAX = 120;

/** 文面（1回の push）から通知の中身を作る。本文は最初の吹き出しの文（画像だけなら「カードが届きました」） */
export function pushPayload(messages: LineMessage[]): PushPayload {
  const texts = messages.map(textOf).filter(Boolean);
  const first = texts[0]?.replace(/\s+/g, " ").trim() ?? "";
  const body = first ? first.slice(0, BODY_MAX) : messages.some((m) => m.type === "image") ? "カードが届きました" : "隊長トークに届いています";
  const extra = texts.length > 1 ? `（ほか ${texts.length - 1} 件）` : "";
  return { title: "シマエナ隊長", body: `${body}${extra}`.slice(0, BODY_MAX + 10), url: "/chat" };
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
export async function sendPush(key: string, payload: PushPayload): Promise<number> {
  if (!configure()) return 0;
  if ((await loadSettings()).linePaused) return 0;
  const subs = await listSubscriptions(key).catch(() => []);
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 6, urgency: "high" });
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await removeSubscription(s.endpoint).catch(() => undefined); // もう届かない端末
      else await recordProblem("push/send", e);
    }
  }
  return sent;
}
