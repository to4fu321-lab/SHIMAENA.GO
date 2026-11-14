// 地図の下のシートで使う、目で見て分かる小さな部品（spec v1.56）: 拠点の番号の丸・人数の人がた・小さな札。
import type { ReactNode } from "react";

/** 拠点の番号（地図のピンと同じ丸）。tone: alert = 人手不足の赤、ink = ふつう、done = 完了 */
export function NumberBadge({ n, tone = "alert", color, size = 44 }: { n: number | string; tone?: "alert" | "ink" | "done"; color?: string; size?: number }) {
  const bg = color ?? (tone === "alert" ? "var(--alert)" : tone === "done" ? "var(--ice)" : "var(--ink)");
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold tabular-nums text-white shadow-sm ring-2 ring-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.45 }}
      aria-hidden="true"
    >
      {tone === "done" ? "✓" : n}
    </span>
  );
}

/** 人数を人がたで: 来ている人はぬり、足りない人は点線のわく（「いま2人 / 必要3人」が一目で分かる） */
export function PeopleDots({ going, required, color = "var(--ink)" }: { going: number; required: number; color?: string }) {
  const total = Math.min(6, Math.max(going, required));
  return (
    <span className="inline-flex items-center gap-0.5 align-middle" role="img" aria-label={`いま ${going}人、必要 ${required}人`}>
      {Array.from({ length: total }, (_, i) => {
        const here = i < going;
        return (
          <svg key={i} viewBox="0 0 20 24" width="18" height="22" aria-hidden="true">
            <circle cx="10" cy="6" r="4.5" fill={here ? color : "none"} stroke={here ? color : "var(--alert)"} strokeWidth="1.8" strokeDasharray={here ? undefined : "3 2"} />
            <path d="M2 23 C2 13 18 13 18 23 Z" fill={here ? color : "none"} stroke={here ? color : "var(--alert)"} strokeWidth="1.8" strokeDasharray={here ? undefined : "3 2"} />
          </svg>
        );
      })}
    </span>
  );
}

/** 小さな札（距離・仕事など） */
export function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "lamp" | "ice" }) {
  const cls = tone === "lamp" ? "bg-warm ring-lamp/50" : tone === "ice" ? "bg-ice-soft ring-ice" : "bg-card ring-ink/15";
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-bold ring-1 ${cls}`}>{children}</span>;
}

/** 距離の札: 「約150m・歩いて2分」（1分 80m） */
export function DistanceChip({ m }: { m?: number }) {
  if (!m) return null;
  return <Chip tone="ice">🚶 約{m}m・歩いて{Math.max(1, Math.ceil(m / 80))}分</Chip>;
}

/** シートの中の見出し（絵文字つき） */
export function SheetHead({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-base font-bold leading-tight">
      <span aria-hidden="true">{icon}</span>
      {children}
    </p>
  );
}
