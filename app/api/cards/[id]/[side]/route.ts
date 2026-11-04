// カードの画像。/api/cards/<id>/front.png（表）・back.png（裏）。?size=preview で小さく、?format=square|portrait で SNS 用、?stamp=0 で消印なし（演出用）。
import { composeForExport, type ExportFormat } from "@/lib/cards/export";
import { svgToPng } from "@/lib/cards/png";
import { withoutStamp } from "@/lib/cards/svg";
import { repo } from "@/lib/repo";

export async function GET(req: Request, ctx: { params: Promise<{ id: string; side: string }> }): Promise<Response> {
  const { id, side } = await ctx.params;
  const found = await repo().getCard(id);
  if (!found) return new Response("カードがありません", { status: 404 });
  const url = new URL(req.url);
  const isBack = side.startsWith("back");
  const wantsSvg = side.endsWith(".svg");
  let svg = isBack ? found.backSvg : found.svg;
  // ?stamp=0: 消印を外した表（完了画面の演出で、あとから動くスタンプを押すため。v1.8）
  if (!isBack && url.searchParams.get("stamp") === "0") svg = withoutStamp(svg);
  const format = url.searchParams.get("format") as ExportFormat | null;
  if (format === "square" || format === "portrait") svg = composeForExport(svg, format);
  if (wantsSvg) {
    return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "public, max-age=31536000, immutable" } });
  }
  const width = url.searchParams.get("size") === "preview" ? 360 : format ? 1080 : 900;
  const png = await svgToPng(svg, { width });
  return new Response(Buffer.from(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
