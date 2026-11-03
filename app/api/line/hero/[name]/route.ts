// LINE のカードの画像（氏名・住所は載せない）。
// /api/line/hero/go.png?t=7:00&n=3 … 行き先カード（時刻と拠点の番号）
// /api/line/hero/snow.png?cm=12&s=ぼた雪のドンブリ&w=eve … 隊長カード（積雪・雪の名前。w=eve 予告／morning 朝）
import { svgToPng } from "@/lib/cards/png";
import { HERO_W, heroParams, renderHeroSvg, renderSnowSvg, snowParams } from "@/lib/line/hero";

export async function GET(req: Request, ctx: { params: Promise<{ name: string }> }): Promise<Response> {
  const { name } = await ctx.params;
  const m = /^(go|snow)\.(png|svg)$/.exec(name);
  if (!m) return new Response("ありません", { status: 404 });
  const q = new URL(req.url).searchParams;
  let svg: string;
  if (m[1] === "go") {
    const { time, base } = heroParams(q.get("t"), q.get("n"));
    svg = renderHeroSvg(time, base);
  } else {
    const p = snowParams(q.get("cm"), q.get("s"), q.get("w"));
    svg = renderSnowSvg(p.cm, p.name, p.when);
  }
  const cache = "public, max-age=86400";
  if (m[2] === "svg") return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": cache } });
  const png = await svgToPng(svg, { width: HERO_W });
  return new Response(Buffer.from(png), { headers: { "Content-Type": "image/png", "Cache-Control": cache } });
}
