// 雪の聞き書きの絵（spec v1.26）。/api/kikigaki/<お話の印>/image.png（?size=preview で小さく）。
// 本人が「届ける」を選んだお話だけ見せる（自分だけのお話の絵は、本人の画面で直接描く）。
import { wrapPicture } from "@/lib/claude/art";
import { svgToPng } from "@/lib/cards/png";
import { storyById } from "@/lib/kikigaki/store";

export async function GET(req: Request, ctx: { params: Promise<{ id: string; file: string }> }): Promise<Response> {
  const { id, file } = await ctx.params;
  if (file !== "image.png") return new Response("ありません", { status: 404 });
  const s = await storyById(id);
  if (!s || !s.share) return new Response("ありません", { status: 404 });
  const width = new URL(req.url).searchParams.get("size") === "preview" ? 360 : 900;
  const png = await svgToPng(wrapPicture(s.svg), { width });
  return new Response(Buffer.from(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=600" } });
}
