// LINE Messaging API を呼ぶ（返信・プッシュ・プロフィール）。サーバー側でだけ使う。
// LINE_CHANNEL_ACCESS_TOKEN がない間・LINE_DRY_RUN=1 の間・/admin/settings で一時停止の間は送らずにログに出す（開発・検証用）。
// 送信の失敗は例外にしない: 1人に届かなくても、残りの人への配信を止めない。失敗は /admin の「問題」に残る。
import { lineDryRun } from "../env";
import { countLinePush } from "../ops/line-usage";
import { loadSettings } from "../ops/settings";
import { recordProblem } from "../ops/problems";
import { fitFive } from "./messages";
import type { LineMessage } from "./types";

const API = "https://api.line.me/v2/bot";

export function hasLineKeys(): boolean {
  return Boolean(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

function token(): string | undefined {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

/** 送る。成功（または送らない設定）で true、失敗で false。例外は投げない */
async function post(pathname: string, body: unknown, pushRecipients = 0): Promise<boolean> {
  const t = token();
  const paused = Boolean(t) && !lineDryRun() && (await loadSettings()).linePaused; // /admin/settings の一時停止
  if (!t || lineDryRun() || paused) {
    console.log(`[line] (送信せず${t ? (paused ? "・管理画面で一時停止" : "・LINE_DRY_RUN") : ""}) POST ${pathname}`, JSON.stringify(body).slice(0, 2000));
    if (t) await countLinePush(pushRecipients, true);
    return true;
  }
  try {
    const res = await fetch(`${API}${pathname}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      await recordProblem(`line${pathname}`, `LINE API が ${res.status} を返しました: ${(await res.text()).slice(0, 200)}`);
      return false;
    }
    await countLinePush(pushRecipients, false);
    return true;
  } catch (e) {
    await recordProblem(`line${pathname}`, e);
    return false;
  }
}

/** 返信（無料。replyToken は1回・約1分だけ有効、5通まで） */
export async function reply(replyToken: string, messages: LineMessage[]): Promise<boolean> {
  if (messages.length === 0) return true;
  return post("/message/reply", { replyToken, messages: fitFive(messages) });
}

/** プッシュ（無料プランは月 200 通までなので、予告・点呼・作戦など大事なものだけに使う）。届けられたら true */
export async function push(to: string, messages: LineMessage[]): Promise<boolean> {
  if (messages.length === 0) return true;
  return post("/message/push", { to, messages: fitFive(messages) }, 1);
}

/** 同じ文面を何人かに送る（500 人まで。通数は人数ぶん数える）。届けられたら true */
export async function multicast(to: string[], messages: LineMessage[]): Promise<boolean> {
  if (to.length === 0 || messages.length === 0) return true;
  const list = to.slice(0, 500);
  return post("/message/multicast", { to: list, messages: fitFive(messages) }, list.length);
}

/** ユーザーが送ってきた画像などの中身を取る（完了写真） */
export async function getMessageContent(messageId: string): Promise<{ bytes: Uint8Array; contentType: string } | undefined> {
  const t = token();
  if (!t) return undefined;
  const res = await fetch(`https://api-data.line.me/v2/bot/message/${encodeURIComponent(messageId)}/content`, {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!res.ok) return undefined;
  return { bytes: new Uint8Array(await res.arrayBuffer()), contentType: res.headers.get("content-type") ?? "" };
}

/** LIFF のアクセストークンから、その人の LINE ユーザー ID を確かめる（画面側の申告を信じない） */
export async function getProfileByAccessToken(accessToken: string): Promise<{ userId: string; displayName: string } | undefined> {
  try {
    const res = await fetch(`${API.replace("/bot", "")}/profile`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { userId?: string; displayName?: string };
    return json.userId ? { userId: json.userId, displayName: json.displayName ?? "" } : undefined;
  } catch {
    return undefined;
  }
}

/** 表示名を取る（呼び名に使う）。取れなければ undefined */
export async function getProfile(userId: string): Promise<{ displayName: string } | undefined> {
  const t = token();
  if (!t) return undefined;
  try {
    const res = await fetch(`${API}/profile/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    if (!res.ok) return undefined;
    const json = (await res.json()) as { displayName?: string };
    return json.displayName ? { displayName: json.displayName } : undefined;
  } catch {
    return undefined;
  }
}
