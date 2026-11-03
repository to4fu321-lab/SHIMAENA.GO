// チーム発表の画像。/api/team/<salvia|marigold|lupinus>.png?from=YYYY-MM-DD&kind=first|weekly（?size=preview で小さく）
import { svgToPng } from "@/lib/cards/png";
import { teamAnnounceSvg } from "@/lib/team-announce";
import { teamTerm } from "@/lib/team-theme";
import { TEAMS } from "@/lib/teams";
import type { TeamId } from "@/lib/types";

export async function GET(req: Request, ctx: { params: Promise<{ file: string }> }): Promise<Response> {
  const { file } = await ctx.params;
  const id = file.replace(/\.(png|svg)$/, "") as TeamId;
  if (!TEAMS.some((t) => t.id === id)) return new Response("チームがありません", { status: 404 });
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) return new Response("from=YYYY-MM-DD が要ります", { status: 400 });
  const kind = url.searchParams.get("kind") === "first" ? "first" : "weekly";
  const svg = teamAnnounceSvg(id, teamTerm(from), kind);
  if (file.endsWith(".svg")) return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } });
  const png = await svgToPng(svg, { width: url.searchParams.get("size") === "preview" ? 300 : 1040 });
  return new Response(Buffer.from(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" } });
}
