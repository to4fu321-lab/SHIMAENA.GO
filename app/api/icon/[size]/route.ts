// アプリのアイコン（ホーム画面・通知）。/api/icon/192.png ・ /api/icon/512.png?maskable=1（安全な余白つき）・/api/icon/96.png?mono=1（通知の小さな印）
// 画像ファイルを持たず、シマエナガの絵（lib/mascot-svg.ts）から作る。
import { svgToPng } from "@/lib/cards/png";
import { mascotInner } from "@/lib/mascot-svg";

export async function GET(req: Request, ctx: { params: Promise<{ size: string }> }): Promise<Response> {
  const { size } = await ctx.params;
  const m = /^(\d{2,4})\.png$/.exec(size);
  if (!m) return new Response("ありません", { status: 404 });
  const px = Math.min(1024, Math.max(32, Number(m[1])));
  const q = new URL(req.url).searchParams;
  const maskable = q.get("maskable") === "1";
  const mono = q.get("mono") === "1";
  // maskable は中身を 80% に（端が丸く切られても欠けない）
  const inner = maskable ? 0.8 : 0.92;
  const svg = mono
    ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="#fff"><ellipse cx="60" cy="64" rx="44" ry="42"/><path d="M96 70 L116 62 L112 78 Z"/></g></svg>`
    : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="${maskable ? 0 : 28}" fill="#F4F7FA"/><g transform="translate(${(60 * (1 - inner)).toFixed(1)} ${(60 * (1 - inner)).toFixed(1)}) scale(${inner})">${mascotInner("normal")}</g></svg>`;
  const png = await svgToPng(svg, { width: px });
  return new Response(Buffer.from(png), { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=604800" } });
}
