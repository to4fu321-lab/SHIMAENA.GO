// 道の報告の写真（小さく縮めた JPEG）。地図のピンと LINE の通知から見る。
import { roadPhoto } from "@/lib/road/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await ctx.params;
  if (!/^[\w-]{1,64}$/.test(id)) return new Response("not found", { status: 404 });
  const b64 = await roadPhoto(id).catch(() => undefined);
  if (!b64) return new Response("not found", { status: 404 });
  return new Response(Buffer.from(b64, "base64"), {
    headers: { "content-type": "image/jpeg", "cache-control": "public, max-age=86400, immutable" },
  });
}
