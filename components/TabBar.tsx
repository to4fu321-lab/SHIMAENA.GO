// 画面のいちばん下のタブ（ホーム／地図／隊長／つなぐ／活動）。アイコンと名前を必ず一緒に出す。
// 11/6 本人の指示「つなぐをいつでも開けるように」: 「使い方」の代わりに「つなぐ」（/connect）。使い方はホーム右上と設定から。
// 「隊長」（隊長トーク、spec v1.17）には未読の数を小さく出す（cookie の本人のもの。画面の部品なので、数は開いたあとに取る）。
// ことば（spec v1.33）: lang を渡すとタブの名前がそのことばに（隊長トークから）。aria-label「メニュー」はタップ音の目印なので変えない。
import Link from "next/link";
import type { IconName } from "@/lib/brand";
import type { Lang } from "@/lib/i18n/langs";
import { t, type UiKey } from "@/lib/i18n/ui";
import ChatBadge from "./ChatBadge";
import Icon from "./Icon";

type Tab = "home" | "map" | "chat" | "connect" | "card";

const TABS: { key: Tab; label: UiKey; icon: IconName; path: string; keepAs: boolean }[] = [
  { key: "home", label: "tabHome", icon: "house", path: "/", keepAs: true },
  { key: "map", label: "tabMap", icon: "map", path: "/map", keepAs: true },
  { key: "chat", label: "tabChat", icon: "chat", path: "/chat", keepAs: true },
  { key: "connect", label: "tabConnect", icon: "connect", path: "/connect", keepAs: true },
  { key: "card", label: "tabCard", icon: "card", path: "/cards", keepAs: true },
];

export default function TabBar({ active, q = "", lang = "ja" }: { active?: Tab; q?: string; lang?: Lang }) {
  const as = /[?&]as=([hr]\d+)/.exec(q)?.[1];
  return (
    <nav className="shrink-0 border-t border-ink/10 bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="メニュー">
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {TABS.map((tab) => {
          const on = tab.key === active;
          return (
            <li key={tab.key} className="relative">
              <Link
                href={`${tab.path}${tab.keepAs ? q : ""}`}
                aria-current={on ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-sm font-bold ${on ? "text-lamp-deep" : "text-ink"}`}
              >
                <Icon name={tab.icon} size={28} accent={on ? "var(--lamp)" : "transparent"} />
                <span className={on ? "border-b-2 border-lamp leading-tight" : "leading-tight"}>{t(lang, tab.label)}</span>
              </Link>
              {tab.key === "chat" && !on && <ChatBadge as={as} />}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
