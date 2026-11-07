// SNS シェアカードの画像。/api/share/today.png（今日の出動）・town.png（町の雪解け）・recruit.png（募集）・me.png（自分の活動）。
// ?format=square（1080 正方形、既定）| story（1080×1920 ストーリーズ）| og（1200×630 リンクの見出し）。.svg でも返す。
import { cookies } from "next/headers";
import { svgToPng } from "@/lib/cards/png";
import { loadPublicStats } from "@/lib/public/load";
import { isQuizType } from "@/lib/public/quiz";
import { quizCardData, renderShareSvg, shareCardData, type ShareFormat } from "@/lib/sns/cards";
import { loadMeStats } from "@/lib/sns/me";
import type { ShareKind } from "@/lib/sns/text";
import { baseUrl } from "@/lib/url";
import { isDemoViewer, readViewer, VIEWER_COOKIE } from "@/lib/viewer";

const KINDS: ShareKind[] = ["today", "town", "recruit", "me"];

export async function GET(req: Request, ctx: { params: Promise<{ kind: string }> }): Promise<Response> {
  const { kind: raw } = await ctx.params;
  const m = /^([a-z]+)(?:-([a-z]+))?\.(png|svg)$/.exec(raw);
  const kind = m?.[1] as ShareKind | "quiz" | undefined;
  const url = new URL(req.url);
  const f = url.searchParams.get("format");
  const format: ShareFormat = f === "story" || f === "og" ? f : "square";
  const site = baseUrl().replace(/^https?:\/\//, "");
  const ext = m?.[3];

  // 診断の結果カード: /api/share/quiz-asa.png（町の数字も個人も使わないので、長くキャッシュしてよい）
  if (kind === "quiz") {
    const type = m?.[2];
    if (!isQuizType(type)) return new Response("ありません", { status: 404 });
    const svg = renderShareSvg(quizCardData(type, `${site}/public/diagnosis`, "しらかばエリア"), format);
    return respond(svg, ext, format, "public, max-age=86400");
  }
  if (!m || !kind || m[2] || !KINDS.includes(kind)) return new Response("ありません", { status: 404 });

  let me: Awaited<ReturnType<typeof loadMeStats>> | undefined;
  if (kind === "me") {
    const as = url.searchParams.get("as");
    const id = as && isDemoViewer(as) ? as : readViewer((await cookies()).get(VIEWER_COOKIE)?.value);
    if (!id) return new Response("LINE から開いてください", { status: 401 });
    me = await loadMeStats(id);
  }
  const stats = await loadPublicStats();
  const svg = renderShareSvg(shareCardData(kind, stats, `${site}/public/town`, me), format);
  // 個人のカードは本人だけ（共有キャッシュに載せない）。町の数字は1分ごとに新しく
  const cache = kind === "me" ? "private, no-store" : "public, s-maxage=60, stale-while-revalidate=300";
  return respond(svg, ext, format, cache);
}

async function respond(svg: string, ext: string | undefined, format: ShareFormat, cache: string): Promise<Response> {
  if (ext === "svg") return new Response(svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": cache } });
  const png = await svgToPng(svg, { width: format === "og" ? 1200 : 1080 });
  return new Response(Buffer.from(png), { headers: { "Content-Type": "image/png", "Cache-Control": cache } });
}
