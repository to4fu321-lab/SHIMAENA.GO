// LINE Messaging API を呼ぶ（返信・プッシュ・プロフィール）。サーバー側でだけ使う。
// LINE_CHANNEL_ACCESS_TOKEN がない間は送らずにログに出す（開発用）。
import type { LineMessage } from "./types";

const API = "https://api.line.me/v2/bot";

export function hasLineKeys(): boolean {
  return Boolean(process.env.LINE_CHANNEL_SECRET && process.env.LINE_CHANNEL_ACCESS_TOKEN);
}

function token(): string | undefined {
  return process.env.LINE_CHANNEL_ACCESS_TOKEN;
}

async function post(pathname: string, body: unknown): Promise<void> {
  const t = token();
  if (!t) {
    console.log(`[line] (送信せず) POST ${pathname}`, JSON.stringify(body));
    return;
  }
  const res = await fetch(`${API}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`LINE API ${pathname} が ${res.status} を返しました: ${await res.text()}`);
  }
}

/** 返信（無料。replyToken は1回・約1分だけ有効、5通まで） */
export async function reply(replyToken: string, messages: LineMessage[]): Promise<void> {
  if (messages.length === 0) return;
  await post("/message/reply", { replyToken, messages: messages.slice(0, 5) });
}

/** プッシュ（無料プランは月 200 通までなので、予告・点呼・作戦など大事なものだけに使う） */
export async function push(to: string, messages: LineMessage[]): Promise<void> {
  if (messages.length === 0) return;
  await post("/message/push", { to, messages: messages.slice(0, 5) });
}

/** 同じ文面を何人かに送る（500 人まで。通数は人数ぶん数える） */
export async function multicast(to: string[], messages: LineMessage[]): Promise<void> {
  if (to.length === 0 || messages.length === 0) return;
  await post("/message/multicast", { to: to.slice(0, 500), messages: messages.slice(0, 5) });
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
