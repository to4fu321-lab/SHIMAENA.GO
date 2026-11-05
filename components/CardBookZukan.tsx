"use client";

// カード図鑑の「図鑑」パネル: 5つのタッチ と リボン・称号 を ‹ › で1ページずつ（1画面に収める）
import { PagedList } from "./Pager";

/** 5つのタッチの、未入手のときの影の色 */
const STYLE_SWATCH: Record<string, string> = {
  kawaii: "linear-gradient(135deg,#ffd1e8,#c7e8ff)",
  retrowave: "linear-gradient(135deg,#2b1055,#ff4f8b)",
  eijin: "linear-gradient(135deg,#0b2fa8,#ffd400)",
  kirie: "linear-gradient(135deg,#f6f0e6,#2a3a5a)",
  pixel: "linear-gradient(135deg,#1a1a2e,#17c964)",
};

export interface ZukanData {
  styles: { style: string; name: string; hint: string; got: boolean; count: number }[];
  ribbons: { key: string; label: string; hint: string; got: boolean }[];
  title?: string;
}

export default function CardBookZukan({ data }: { data: ZukanData }) {
  const { styles, ribbons, title } = data;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label="図鑑">
      <div className="flex shrink-0 items-baseline justify-between">
        <h2 className="text-lg font-bold">図鑑</h2>
        <p className="text-sm text-ink-soft">
          タッチ {styles.filter((s) => s.got).length}/{styles.length} ・ リボン {ribbons.filter((r) => r.got).length}/{ribbons.length}
        </p>
      </div>
      <PagedList
        label="図鑑のページ"
        items={["styles", "ribbons"] as const}
        render={(page) =>
          page === "styles" ? (
            <div key="styles" className="space-y-2">
              <h3 className="text-base font-bold">5つのタッチ</h3>
              <ul className="grid grid-cols-3 gap-x-3 gap-y-2">
                {styles.map((s) => (
                  <li key={s.style} className="text-center">
                    <div
                      className={`h-16 w-full rounded-xl ring-1 ring-ink/10 ${s.got ? "" : "opacity-30 grayscale"}`}
                      style={{ background: STYLE_SWATCH[s.style] }}
                      aria-label={`${s.name}${s.got ? "（取得）" : "（未入手）"}`}
                    >
                      {s.got && <span className="block pt-2 text-xs font-bold text-white drop-shadow">×{s.count}</span>}
                    </div>
                    <p className="mt-1 text-xs leading-tight">{s.name}</p>
                    {!s.got && <p className="text-xs leading-tight text-ink-soft">{s.hint}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div key="ribbons" className="space-y-3">
              <h3 className="text-base font-bold">リボン</h3>
              <ul className="space-y-2" aria-label="リボン">
                {ribbons.map((r) => (
                  <li
                    key={r.key}
                    className={`flex items-baseline justify-between gap-2 rounded-full px-3 py-1 text-base font-bold ring-1 ${r.got ? "bg-camellia text-ink ring-camellia-deep" : "bg-card text-ink-soft ring-ink/15"}`}
                  >
                    <span>
                      {r.got ? "★ " : "☆ "}
                      {r.label}
                    </span>
                    <span className="text-sm font-normal">{r.hint}</span>
                  </li>
                ))}
              </ul>
              <p className="text-base">
                今週の称号: {title ? <b className="text-camellia-deep">{title}</b> : <span className="text-ink-soft">まだ（週に3日出撃で称号、5日でレアカード確定）</span>}
              </p>
            </div>
          )
        }
      />
    </div>
  );
}
