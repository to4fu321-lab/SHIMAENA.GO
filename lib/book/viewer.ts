// 週刊絵本を画面に渡す形（絵は URL。?v= は描き上がるたびに変わる）
import type { ViewerBook } from "@/components/BookViewer";
import type { Book } from "./store";

export function viewerOf(b: Book): ViewerBook {
  const stamp = b.at.replace(/\D/g, "").slice(-8);
  const src = (i: number, by?: string) => `/api/book/${b.weekStart}/${i}.svg?v=${by ?? "p"}-${stamp}`;
  return {
    weekStart: b.weekStart,
    title: b.title,
    subtitle: b.subtitle,
    cover: { text: "", src: src(0, b.cover.drawnBy), claude: b.cover.drawnBy === "claude" },
    pages: b.pages.map((p, i) => ({ text: p.text, src: src(i + 1, p.drawnBy), claude: p.drawnBy === "claude" })),
    status: b.status,
    drawn: b.drawn,
    total: b.total,
    by: b.by,
  };
}
