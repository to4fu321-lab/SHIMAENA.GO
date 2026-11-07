// 声のありがとう（spec v1.29）の音。聞けるのは、その家の人と、その家を手伝った人だけ。
// 離れて暮らす家族（11/7）: 自分が吹き込んだ家族の声（<ID>-family）は、その家に紐づいた家族も聞き直せる。
import { cookies } from "next/headers";
import { PENDING_COOKIE, readPending } from "@/lib/auth/pending";
import { familyVoiceRequester } from "@/lib/morning/ops";
import { isFamilyVoiceId, missionIdOfVoice, readThanksVoice } from "@/lib/thanks/voice";
import { isDemoViewer, readViewer, trustedViewer, VIEWER_COOKIE } from "@/lib/viewer";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!/^[\w-]{1,80}$/.test(id)) return new Response("ありません", { status: 404 });
  const as = new URL(req.url).searchParams.get("as") ?? "";
  const jar = await cookies();
  let viewerId = as && isDemoViewer(as) ? await trustedViewer(as) : readViewer(jar.get(VIEWER_COOKIE)?.value);
  if (!viewerId && isFamilyVoiceId(id)) {
    // 家族: その家に紐づいていれば、家の人と同じに扱う（家族の声だけ）
    const pending = readPending(jar.get(PENDING_COOKIE)?.value);
    viewerId = (pending && (await familyVoiceRequester(missionIdOfVoice(id), pending.lineUserId).catch(() => undefined))) || null;
  }
  if (!viewerId) return new Response("ありません", { status: 404 });
  const v = await readThanksVoice(id, viewerId).catch(() => undefined);
  if (!v) return new Response("ありません", { status: 404 });
  return new Response(Buffer.from(v.audio), {
    headers: { "content-type": v.mime, "cache-control": "private, no-store" },
  });
}
