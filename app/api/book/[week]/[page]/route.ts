// 週刊絵本のさし絵（spec v1.27）。/api/book/<週の始まり>/<0=表紙, 1〜6>.svg。?v= が変わると描き上がった新しい絵。
import { PAGE_H, PAGE_W } from "@/lib/book/draw";
import { loadBook } from "@/lib/book/store";
import { wrapIllustration } from "@/lib/claude/illustrate";

export async function GET(_req: Request, ctx: { params: Promise<{ week: string; page: string }> }): Promise<Response> {
  const { week, page } = await ctx.params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week)) return new Response("週の形がちがいます", { status: 400 });
  const n = Number(page.replace(/\.svg$/, ""));
  const book = await loadBook(week);
  const p = book && (n === 0 ? book.cover : book.pages[n - 1]);
  if (!book || !p?.svg) return new Response("ページがありません", { status: 404 });
  return new Response(wrapIllustration(p.svg, PAGE_W, PAGE_H), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // 描いている間は貯めない（同じ URL でも新しい絵に差しかわる）
      "Cache-Control": book.status === "drawing" ? "no-store" : "public, max-age=86400",
    },
  });
}
