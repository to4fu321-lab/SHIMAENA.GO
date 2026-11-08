// 画面のいちばん下のタブ（ホーム／マップ／チーム／つなぐ／きろく）。アイコンと名前を必ず一緒に出す。
// 11/6 本人の指示「つなぐをいつでも開けるように」: 「使い方」の代わりに「つなぐ」（/connect）。使い方はホーム右上と設定から。
// 11/7 本人の指示: 真ん中は「隊長」から「チーム」（/team）に。隊長トークはホームの吹き出し「隊長に相談する」から開く。
// 11/8 本人の指示「💬を常に画面に置いておく。邪魔な時は動かせるように」: タブのある画面には、隊長トークへの浮かぶボタン（ChatFab）も出す（spec v1.43）。
// ことば（spec v1.36）: lang を渡すとタブの名前がそのことばに（隊長トークから）。aria-label「メニュー」はタップ音の目印なので変えない。
import Link from "next/link";
import type { IconName } from "@/lib/brand";
import type { Lang } from "@/lib/i18n/langs";
import { t, type UiKey } from "@/lib/i18n/ui";
import ChatFab from "./ChatFab";
import Icon from "./Icon";

type Tab = "home" | "map" | "team" | "connect" | "card";

const TABS: { key: Tab; label: UiKey; icon: IconName; path: string; keepAs: boolean }[] = [
  { key: "home", label: "tabHome", icon: "house", path: "/", keepAs: true },
  { key: "map", label: "tabMap", icon: "map", path: "/map", keepAs: true },
  { key: "team", label: "tabTeam", icon: "team", path: "/team", keepAs: true },
  { key: "connect", label: "tabConnect", icon: "connect", path: "/connect", keepAs: true },
  { key: "card", label: "tabCard", icon: "card", path: "/cards", keepAs: true },
];

export default function TabBar({ active, q = "", lang = "ja", fab = true }: { active?: Tab; q?: string; lang?: Lang; fab?: boolean }) {
  return (
    <>
      {fab && <ChatFab q={q} label={t(lang, "placeholder")} />}
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
            </li>
          );
        })}
      </ul>
      </nav>
    </>
  );
}
