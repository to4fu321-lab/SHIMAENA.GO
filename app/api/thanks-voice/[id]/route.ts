// 声のありがとう（spec v1.29）の音。聞けるのは、その家の人と、その家を手伝った人だけ。
import { cookies } from "next/headers";
import { readThanksVoice } from "@/lib/thanks/voice";
import { isDemoViewer, readViewer, trustedViewer, VIEWER_COOKIE } from "@/lib/viewer";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!/^[\w-]{1,80}$/.test(id)) return new Response("ありません", { status: 404 });
  const as = new URL(req.url).searchParams.get("as") ?? "";
  const viewerId = as && isDemoViewer(as) ? await trustedViewer(as) : readViewer((await cookies()).get(VIEWER_COOKIE)?.value);
  if (!viewerId) return new Response("ありません", { status: 404 });
  const v = await readThanksVoice(id, viewerId).catch(() => undefined);
  if (!v) return new Response("ありません", { status: 404 });
  return new Response(Buffer.from(v.audio), {
    headers: { "content-type": v.mime, "cache-control": "private, no-store" },
  });
}
