// LINE のリッチメニューと同じ4つ（出動する／町の地図／活動カード／使い方）を Web にも。色・アイコン・名前をそろえる。
import Link from "next/link";
import { MENU, type MenuKey } from "@/lib/brand";
import Icon from "./Icon";

export default function MenuTiles({ hrefs }: { hrefs: Record<"go" | "map" | "card" | "guide", string> }) {
  const tile = (key: MenuKey, big = false) => {
    const m = MENU[key];
    return (
      <Link
        key={key}
        href={hrefs[key as keyof typeof hrefs]}
        className={`flex items-center gap-3 rounded-2xl px-3 shadow-sm active:scale-[0.98] ${big ? "min-h-20 py-3" : "min-h-16 py-2"} ${key === "guide" ? "ring-1 ring-ink/25" : ""}`}
        style={{ background: m.bg, color: m.fg }}
      >
        <span className={`grid shrink-0 place-items-center rounded-full bg-white text-ink ${big ? "size-14" : "size-11"}`}>
          <Icon name={m.icon} size={big ? 40 : 30} accent={key === "go" ? m.bg : m.accent} />
        </span>
        <span className="min-w-0 leading-tight">
          <span className={`block font-bold ${big ? "text-2xl" : "text-lg"}`}>{m.label}</span>
          <span className="block text-sm font-bold">{m.sub}</span>
        </span>
      </Link>
    );
  };
  return (
    <nav className="grid gap-2.5" aria-label="メニュー（LINE のメニューと同じ）">
      {tile("go", true)}
      {tile("map")}
      {tile("card")}
      {tile("guide")}
    </nav>
  );
}
