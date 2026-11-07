// 「雪かきをお願いする」の絵（11/6 本人の指示「UI を分かりやすく、画像やアイコンを使って」）。
// 頼み方（おまかせ／一緒にやる）と、どこまで（玄関前／車庫前／道路まで）を、小さな絵で見せる。文字が読めなくても選べるように。
import type { ClearArea, HelpStyle } from "@/lib/types";

const INK = "#29445c";
const LAMP = "#d9825b";
const SNOW = "#ffffff";
const WALL = "#f5eee5";
const ROOF = "#c9d8e4";

/** 人（頭と体）。shovel で雪かきスコップを持つ */
export function Person({ x, y, color, shovel = false, s = 1 }: { x: number; y: number; color: string; shovel?: boolean; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="0" cy="-22" r="7" fill="#f3e2c8" stroke={INK} strokeWidth="1.5" />
      <path d="M-9 -14 Q0 -18 9 -14 L8 8 H-8 Z" fill={color} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M-4 8 V20 M4 8 V20" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      {shovel && (
        <g transform="rotate(-25 14 0)">
          <path d="M14 -12 V12" stroke="#7a5a44" strokeWidth="3" strokeLinecap="round" />
          <path d="M9 12 H19 L17 22 H11 Z" fill={LAMP} stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
        </g>
      )}
    </g>
  );
}

export function House({ x = 0, y = 0, w = 60 }: { x?: number; y?: number; w?: number }) {
  const h = w * 0.75;
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 ${h * 0.45} L${w / 2} 0 L${w} ${h * 0.45} V${h} H0 Z`} fill={WALL} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d={`M-4 ${h * 0.47} L${w / 2} -2 L${w + 4} ${h * 0.47}`} fill="none" stroke={ROOF} strokeWidth="6" strokeLinecap="round" />
      <path d={`M-4 ${h * 0.47} L${w / 2} -2 L${w + 4} ${h * 0.47}`} fill="none" stroke={SNOW} strokeWidth="3" strokeLinecap="round" />
      <rect x={w * 0.4} y={h * 0.6} width={w * 0.2} height={h * 0.4} rx="2" fill="#3b6584" />
    </g>
  );
}

/** 頼み方の絵: おまかせ＝家の人は窓の中、手伝う人2人が雪かき／一緒にやる＝家の人もスコップを持って外に */
export function StyleArt({ style, active }: { style: HelpStyle; active: boolean }) {
  const team = active ? "#fff" : "#8fb8c9";
  const owner = active ? "#fff" : "#c8a7b8";
  return (
    <svg viewBox="0 0 120 70" className="h-14 w-full short:h-10" aria-hidden="true">
      <rect x="0" y="56" width="120" height="14" rx="4" fill={active ? "rgba(255,255,255,0.35)" : "#eef3f7"} />
      <House x={6} y={8} w={46} />
      {style === "omakase" ? (
        <>
          <rect x="16" y="24" width="12" height="10" rx="1" fill="#f3c48a" />
          <circle cx="22" cy="30" r="3" fill="#f3e2c8" stroke={INK} strokeWidth="1" />
          <Person x={74} y={44} color={team} shovel />
          <Person x={102} y={44} color={team} shovel />
        </>
      ) : (
        <>
          <Person x={62} y={44} color={owner} shovel />
          <Person x={96} y={44} color={team} shovel />
        </>
      )}
    </svg>
  );
}

/** どこまでの絵: 家の玄関から道路までの通路。選んだ範囲を色で塗る */
export function AreaArt({ area, active }: { area: ClearArea; active: boolean }) {
  const fill = active ? "#fff" : LAMP;
  const len = area === "entrance" ? 26 : area === "garage" ? 58 : 100;
  return (
    <svg viewBox="0 0 120 60" className="h-12 w-full short:h-9" aria-hidden="true">
      {/* 道路（右端） */}
      <rect x="104" y="0" width="16" height="60" fill={active ? "rgba(255,255,255,0.25)" : "#dfe6ec"} />
      <path d="M112 4 V56" stroke={active ? "#fff" : "#fff"} strokeWidth="2" strokeDasharray="5 5" />
      {/* 通路（雪） */}
      <rect x="4" y="38" width="100" height="14" rx="3" fill={active ? "rgba(255,255,255,0.3)" : "#eef3f7"} />
      {/* 家と車庫 */}
      <House x={4} y={6} w={30} />
      <g transform="translate(46 14)">
        <rect x="0" y="6" width="26" height="18" rx="2" fill={WALL} stroke={INK} strokeWidth="2" />
        <path d="M-2 7 L13 0 L28 7" fill="none" stroke={ROOF} strokeWidth="5" strokeLinecap="round" />
        <path d="M4 12 H22 M4 16 H22 M4 20 H22" stroke={INK} strokeWidth="1.2" />
      </g>
      {/* 雪かきする範囲 */}
      <rect x="4" y="38" width={len} height="14" rx="3" fill={fill} opacity={active ? 0.9 : 0.85} />
      <path d={`M8 45 H${len}`} stroke={active ? LAMP : "#fff"} strokeWidth="2" strokeDasharray="3 3" />
    </svg>
  );
}

/** 登録の「手伝う／手伝ってほしい」の絵（11/7 本人の指示「もっと視覚的に」）。
 *  helper = スコップを持って近所の家へ向かう人／requester = 雪に埋もれた家に、応援が2人やってくる */
export function RoleArt({ role, active }: { role: "helper" | "requester"; active: boolean }) {
  const me = active ? "#fff" : LAMP;
  const team = active ? "#fff" : "#8fb8c9";
  return (
    <svg viewBox="0 0 120 80" className="h-24 w-full short:h-16" aria-hidden="true">
      <rect x="0" y="64" width="120" height="16" rx="4" fill={active ? "rgba(255,255,255,0.35)" : "#eef3f7"} />
      {role === "helper" ? (
        <>
          <House x={66} y={22} w={48} />
          {/* 家の前の雪 */}
          <path d="M60 66 Q72 54 86 62 Q100 52 116 64 Z" fill={SNOW} stroke={active ? "rgba(255,255,255,0.6)" : "#c9d8e4"} strokeWidth="1.5" />
          <Person x={28} y={50} color={me} shovel s={1.2} />
          {/* 向かう矢印 */}
          <path d="M44 30 H56 M51 25 L57 30 L51 35" fill="none" stroke={active ? "#fff" : INK} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <House x={6} y={14} w={56} />
          {/* 窓に家の人 */}
          <rect x="18" y="38" width="12" height="10" rx="1" fill="#f3c48a" />
          <circle cx="24" cy="44" r="3" fill="#f3e2c8" stroke={INK} strokeWidth="1" />
          {/* 家のまわりの雪 */}
          <path d="M0 66 Q14 50 30 60 Q46 48 66 64 Z" fill={SNOW} stroke={active ? "rgba(255,255,255,0.6)" : "#c9d8e4"} strokeWidth="1.5" />
          <Person x={84} y={52} color={team} shovel />
          <Person x={108} y={52} color={team} shovel />
          {/* ハート（応援が届く） */}
          <path d="M96 14 C96 10 90 10 90 14 C90 18 96 21 96 23 C96 21 102 18 102 14 C102 10 96 10 96 14 Z" fill={active ? "#fff" : "#e7a3b8"} />
        </>
      )}
    </svg>
  );
}
