// 画面のいちばん下のタブ（ホーム／地図／隊長／活動／使い方）。アイコンと名前を必ず一緒に出す。
// 「隊長」（隊長トーク、spec v1.17）には未読の数を小さく出す（cookie の本人のもの。画面の部品なので、数は開いたあとに取る）。
import Link from "next/link";
import type { IconName } from "@/lib/brand";
import ChatBadge from "./ChatBadge";
import Icon from "./Icon";

type Tab = "home" | "map" | "chat" | "card" | "guide";

const TABS: { key: Tab; label: string; icon: IconName; path: string; keepAs: boolean }[] = [
  { key: "home", label: "ホーム", icon: "house", path: "/", keepAs: true },
  { key: "map", label: "地図", icon: "map", path: "/map", keepAs: true },
  { key: "chat", label: "隊長", icon: "chat", path: "/chat", keepAs: true },
  { key: "card", label: "活動", icon: "card", path: "/cards", keepAs: true },
  { key: "guide", label: "使い方", icon: "guide", path: "/rules", keepAs: false },
];

export default function TabBar({ active, q = "" }: { active: Tab; q?: string }) {
  const as = /[?&]as=([hr]\d+)/.exec(q)?.[1];
  return (
    <nav className="shrink-0 border-t border-ink/10 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="メニュー">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map((t) => {
          const on = t.key === active;
          return (
            <li key={t.key} className="relative">
              <Link
                href={`${t.path}${t.keepAs ? q : ""}`}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-bold ${on ? "text-lamp-deep" : "text-ink"}`}
              >
                <Icon name={t.icon} size={28} accent={on ? "var(--lamp)" : "transparent"} />
                <span className={on ? "border-b-2 border-lamp leading-tight" : "leading-tight"}>{t.label}</span>
              </Link>
              {t.key === "chat" && !on && <ChatBadge as={as} />}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
