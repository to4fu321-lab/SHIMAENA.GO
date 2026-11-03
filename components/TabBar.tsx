// 画面のいちばん下のタブ（ホーム／地図／活動／使い方）。アイコンと名前を必ず一緒に出す。
import Link from "next/link";
import type { IconName } from "@/lib/brand";
import Icon from "./Icon";

type Tab = "home" | "map" | "card" | "guide";

const TABS: { key: Tab; label: string; icon: IconName; path: string; keepAs: boolean }[] = [
  { key: "home", label: "ホーム", icon: "house", path: "/", keepAs: true },
  { key: "map", label: "地図", icon: "map", path: "/map", keepAs: true },
  { key: "card", label: "活動", icon: "card", path: "/cards", keepAs: true },
  { key: "guide", label: "使い方", icon: "guide", path: "/rules", keepAs: false },
];

export default function TabBar({ active, q = "" }: { active: Tab; q?: string }) {
  return (
    <nav className="shrink-0 border-t border-ink/10 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="メニュー">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key}>
              <Link
                href={`${t.path}${t.keepAs ? q : ""}`}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-bold ${on ? "text-lamp-deep" : "text-ink"}`}
              >
                <Icon name={t.icon} size={28} accent={on ? "var(--lamp)" : "transparent"} />
                <span className={on ? "border-b-2 border-lamp leading-tight" : "leading-tight"}>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
