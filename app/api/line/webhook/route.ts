// LINE からの Webhook。署名を確かめてから、イベントを1つずつ処理する。
// LINE Developers の Webhook URL に https://<公開URL>/api/line/webhook を設定する。
// 先に 200 を返し、処理は返したあとに続ける（Claude の写真確認などで時間がかかっても、LINE を待たせない）。
// 同じイベントの送り直しは1回だけ処理する。今朝の状態は1つずつ書き換える（2台が同時に押しても消えない）。
import { after } from "next/server";
import { processEvents } from "@/lib/line/process";
import { verifySignature } from "@/lib/line/signature";
import type { WebhookBody } from "@/lib/line/types";

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return new Response("LINE_CHANNEL_SECRET がありません", { status: 503 });

  const body = await req.text();
  if (!verifySignature(body, req.headers.get("x-line-signature"), secret)) {
    return new Response("署名が違います", { status: 401 });
  }

  let events: WebhookBody["events"] = [];
  try {
    events = (JSON.parse(body) as WebhookBody).events ?? [];
  } catch {
    return new Response("本文が読めません", { status: 400 });
  }

  after(() => processEvents(events));
  return Response.json({ ok: true, received: events.length });
}

/** ブラウザで開いたときの確認用 */
export function GET(): Response {
  return Response.json({ ok: true, hint: "LINE の Webhook はここに POST で届きます" });
}
