// LINE の行き先カードの画像。/api/line/hero/go.png?t=7:00&n=3（時刻と拠点の番号だけ。氏名・住所は載せない）
import { svgToPng } from "@/lib/cards/png";
import { HERO_W, heroParams, renderHeroSvg } from "@/lib/line/hero";

export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }): Promise<Response> {
  const { name } = await ctx.params;
  if (name !== "go.png" && name !== "go.svg") return new Response("ありません", { status: 404 });
  const url = new URL(req.url);
  const { time, base } = heroParams(url.searchParams.get("t"), url.searchParams.get("n"));
  const svg = renderHeroSvg(time, base);
  const cache = "public, max-age=86400";
  if (name.endsWith(".svg")) return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": cache } });
  const png = await svgToPng(svg, { width: HERO_W });
  return new Response(Buffer.from(png), { headers: { "Content-Type": "image/png", "Cache-Control": cache } });
}
