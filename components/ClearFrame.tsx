"use client";

// 完了画面（ソロのクリア・家の MISSION CLEAR）の共通の枠（11/5 本人の指示「基本1画面」）。
// 重ね画面の高さを画面ぴったりにして縦にスクロールさせない。上に喜ぶ演出、まん中はタブ（Pager）、
// 下に閉じるボタン（いつも見える）。
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { PagedList } from "./Pager";
import Pager, { type PagerTab } from "./Pager";

export default function ClearFrame({
  label,
  hero,
  decor,
  tabs,
  index,
  onTab,
  footer,
  heroOn = true,
  children,
}: {
  /** 読み上げ用の名前（「ソロ出動 完了」など） */
  label: string;
  /** 上の喜ぶ演出（シマエナガと見出し） */
  hero: ReactNode;
  /** 舞う羽など、後ろに重ねる飾り */
  decor?: ReactNode;
  tabs: PagerTab[];
  index?: number;
  onTab?: (i: number) => void;
  /** 下の閉じるボタンなど */
  footer: ReactNode;
  /** 喜ぶ演出を出すか（最初の「けっか」だけ。ほかのタブは画面の高さをぜんぶ使う） */
  heroOn?: boolean;
  children: ReactNode;
}) {
  return (
    // z-[1200]: Leaflet の地図（z-index 400〜1000）より手前に出す
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-ink/70 p-2 backdrop-blur-sm" role="dialog" aria-label={label}>
      <div className="relative flex h-[calc(100dvh-16px)] max-h-[860px] w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-paper text-ink shadow-2xl">
        {decor}
        {heroOn ? <div className="relative shrink-0">{hero}</div> : <div className="h-3 shrink-0" />}
        <Pager tabs={tabs} index={index} onChange={onTab}>
          {children}
        </Pager>
        <div className="relative shrink-0 px-4 pb-3 pt-1">{footer}</div>
      </div>
    </div>
  );
}

/** パネルの中の、縦にまん中寄せの入れ物（中身が少ないときに上に寄りすぎないように） */
export function Panel({ children, center = false }: { children: ReactNode; center?: boolean }) {
  return <div className={`flex min-h-0 flex-1 flex-col gap-2 ${center ? "justify-center" : ""}`}>{children}</div>;
}

/** カードの演出を、パネルの残りの高さに合わせて縮める（カードは 600:840。タブ・カードの説明〔4行まで〕・閉じるボタンのぶん 390px を引く。カードのタブでは喜ぶ演出を出さない） */
export const FIT_CARD = "[&_figure]:max-w-[min(18rem,calc((100dvh_-_390px)*0.714))]";
/** カードの画像（演出なし）を、パネルの残りの高さに合わせて縮める */
export const FIT_IMG = "[&_img]:mx-auto [&_img]:max-h-[calc(100dvh_-_400px)] [&_img]:w-auto";

/**
 * 「つなぐ」タブ: 共有（SNS・自慢の画像を1つずつ）／誘う（招待文）／バトン／次は？ を上のボタンで1つだけ出す。
 * タブを4つまでにして、タブの名前が2行にならないようにするため（小さいスマホ）。
 */
export function ConnectPanel({ shares, invite, baton, more }: { shares: ReactNode[]; invite?: ReactNode; baton?: (view: "baton" | "wish") => ReactNode; /** 「つなぐ」の画面へのリンク（?as= つき） */ more?: string }) {
  const opts = [
    ...(shares.length > 0 ? [["share", "広める"] as const] : []),
    ...(invite ? [["invite", "誘う"] as const] : []),
    ...(baton ? ([["baton", "バトン"], ["wish", "次は？"]] as const) : []),
  ];
  const [view, setView] = useState<string>(opts[0]?.[0] ?? "share");
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      {opts.length > 1 && (
        <div className="grid shrink-0 gap-2" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0, 1fr))` }} role="tablist">
          {opts.map(([k, label]) => (
            <button key={k} role="tab" aria-selected={view === k} onClick={() => setView(k)} className={`min-h-12 rounded-2xl px-1 text-base font-bold ring-2 ${view === k ? "bg-ink text-white ring-ink" : "bg-card ring-ink/15"}`}>
              {label}
            </button>
          ))}
        </div>
      )}
      {view === "share" ? (
        <PagedList items={shares} label="知らせる" render={(node, i) => <div key={i} className="flex min-h-0 flex-1 flex-col justify-center">{node}</div>} />
      ) : view === "invite" ? (
        <div className="flex min-h-0 flex-1 flex-col justify-center">{invite}</div>
      ) : (
        baton?.(view === "wish" ? "wish" : "baton")
      )}
      {more && (
        <Link href={more} className="shrink-0 text-center text-base font-bold underline">
          もっとつなぐ（広める・誘う・バトン・なかま） ›
        </Link>
      )}
    </div>
  );
}
