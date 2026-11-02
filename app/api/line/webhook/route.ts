// LINE からの Webhook。署名を確かめてから、イベントを1つずつ処理する。
// LINE Developers の Webhook URL に https://<公開URL>/api/line/webhook を設定する。
import { handleEvent } from "@/lib/line/handle";
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

  for (const ev of events) {
    try {
      await handleEvent(ev);
    } catch (e) {
      // 1件の失敗で他のイベントを止めない。LINE には 200 を返す（返さないと同じイベントが再送される）
      console.error("[line/webhook] イベントの処理に失敗:", e instanceof Error ? e.message : e);
    }
  }
  return Response.json({ ok: true, received: events.length });
}

/** ブラウザで開いたときの確認用 */
export function GET(): Response {
  return Response.json({ ok: true, hint: "LINE の Webhook はここに POST で届きます" });
}
