// 通知のボタンから答える（spec v1.31 スマートウォッチ）。service worker が、通知を開かずにここへ送る。
// 誰かは cookie の本人（ログインの印）だけで決める。答えられるのは、点呼の答えと人手が足りない家への返事だけ。
import { cookies } from "next/headers";
import { sendToCaptain } from "@/lib/chat/send";
import { inboxKeyOf } from "@/lib/inbox/key";
import { listThread } from "@/lib/inbox/store";
import { textOf } from "@/lib/line/flex";
import { repo } from "@/lib/repo";
import { readViewer, VIEWER_COOKIE } from "@/lib/viewer";

const ALLOWED = /^(rc:ans=[a-z0-9]+|help:go=[\w-]{1,60}|help:no)$/;

export async function POST(req: Request): Promise<Response> {
  const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
  const viewerId = readViewer((await cookies()).get(VIEWER_COOKIE)?.value);
  if (!viewerId) return json({ ok: false, text: "ログインしてから答えてください。" }, 401);
  let data = "";
  let label = "";
  try {
    const b = (await req.json()) as { data?: unknown; label?: unknown };
    data = typeof b.data === "string" ? b.data : "";
    label = typeof b.label === "string" ? b.label.slice(0, 40) : "";
  } catch {
    return json({ ok: false, text: "読めませんでした。" }, 400);
  }
  if (!ALLOWED.test(data)) return json({ ok: false, text: "この答えは、アプリを開いて送ってください。" }, 400);
  const p = await repo().findParticipant(viewerId);
  if (!p) return json({ ok: false, text: "登録が見つかりません。" }, 404);
  const key = inboxKeyOf(p);
  const sent = await sendToCaptain(p, { kind: "postback", data, label: label || undefined }, new Date());
  if (!sent || !key) return json({ ok: false, text: "送れませんでした。" }, 409);
  // 隊長の返事の最初の 1 行を、受け付けの通知の本文に（時計の画面に収まる長さ）
  const thread = await listThread(key, 6).catch(() => []);
  const reply = [...thread].reverse().find((i) => i.dir === "out");
  const text = reply && "type" in reply.body ? textOf(reply.body).replace(/\s+/g, " ").trim().slice(0, 80) : "";
  return json({ ok: true, text });
}
