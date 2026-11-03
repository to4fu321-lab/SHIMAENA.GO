// LINE の行き先カードの大きな画像（1040×676、20:13）。図形から SVG で描き、/api/line/hero/go.png で PNG にする。
// 載せるのは時刻と拠点の番号だけ（氏名・住所・位置は入れない）。
import { COLORS } from "../brand";
import { escapeXml } from "../cards/svg";

export const HERO_W = 1040;
export const HERO_H = 676;

/** URL から来た値を、画像に載せてよい形にそろえる（変な値は既定に戻す） */
export function heroParams(t: string | null, n: string | null): { time: string; base: string } {
  const time = t && /^(\d{1,2}:\d{2}|now)$/.test(t) ? t : "7:00";
  const base = n && /^[0-9A-Za-z?]{1,4}$/.test(n) ? n : "?";
  return { time, base };
}

/** シマエナガ（オレンジのマフラー）。components/Mascot.tsx と同じ絵。x, y は左上、s は倍率（元は 120px） */
function mascot(x: number, y: number, s: number): string {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M96 70 L116 62 L112 78 Z" fill="#29445c"/>
    <ellipse cx="60" cy="64" rx="44" ry="42" fill="#ffffff" stroke="#dbe6ee" stroke-width="2"/>
    <path d="M88 52 C104 62 104 86 86 96 C90 82 88 66 80 56 Z" fill="#29445c"/>
    <path d="M32 56 C14 50 8 30 18 22 C24 36 32 44 42 50 Z" fill="#3b6584"/>
    <path d="M40 54 Q45 48 50 54" fill="none" stroke="#1d2f40" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M70 54 Q75 48 80 54" fill="none" stroke="#1d2f40" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M56 60 L64 60 L60 66 Z" fill="#1d2f40"/>
    <ellipse cx="36" cy="64" rx="6" ry="3.6" fill="#f2b8bf" opacity="0.8"/>
    <ellipse cx="84" cy="64" rx="6" ry="3.6" fill="#f2b8bf" opacity="0.8"/>
    <path d="M22 76 C40 88 80 88 98 76 L98 86 C80 98 40 98 22 86 Z" fill="#e8834f"/>
    <path d="M70 88 L78 112 L90 108 L84 86 Z" fill="#d06d3b"/>
  </g>`;
}

/** 雪の家（灯りつき）。x は左端、w は幅、ground は地面の高さ */
function house(x: number, w: number, h: number, ground: number): string {
  const top = ground - h;
  return `<g>
    <path d="M${x} ${top + 30} L${x + w / 2} ${top - 10} L${x + w} ${top + 30} V${ground} H${x} Z" fill="#c9d8e4"/>
    <path d="M${x - 8} ${top + 32} L${x + w / 2} ${top - 16} L${x + w + 8} ${top + 32}" fill="none" stroke="#fff" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="${x + w / 2 - 14}" y="${top + 46}" width="28" height="24" rx="4" fill="#f3c48a"/>
  </g>`;
}

export function renderHeroSvg(time: string, base: string): string {
  const big = time === "now" ? "いますぐ" : time;
  const tail = time === "now" ? "向かいます！" : "に集合です！";
  const ground = 600;
  const flakes = [
    [80, 230, 6], [210, 300, 4], [380, 250, 5], [560, 320, 4], [700, 240, 6], [880, 300, 5], [980, 230, 4], [140, 400, 4], [940, 420, 5],
  ]
    .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="0.9"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${HERO_W}" height="${HERO_H}" viewBox="0 0 ${HERO_W} ${HERO_H}" font-family="Zen Maru Gothic, sans-serif">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe2ee"/><stop offset="1" stop-color="#f4f7fa"/></linearGradient>
  </defs>
  <rect width="${HERO_W}" height="${HERO_H}" fill="url(#sky)"/>
  ${flakes}
  <!-- 上の帯: 何時に -->
  <rect x="0" y="0" width="${HERO_W}" height="190" fill="${COLORS.ink}"/>
  <g transform="translate(60 52)">
    <path d="M30 0 C13 0 0 13 0 30 C0 52 30 86 30 86 C30 86 60 52 60 30 C60 13 47 0 30 0 Z" fill="${COLORS.lamp}"/>
    <circle cx="30" cy="30" r="12" fill="#fff"/>
  </g>
  <text x="150" y="128" font-size="${time === "now" ? 92 : 112}" font-weight="700" fill="#ffd36e">${escapeXml(big)}</text>
  <text x="${time === "now" ? 560 : 400}" y="124" font-size="64" font-weight="700" fill="#fff">${escapeXml(tail)}</text>
  <!-- 木と家 -->
  <path d="M60 ${ground} L110 ${ground - 170} L160 ${ground} Z" fill="#a9c1d4"/>
  <path d="M900 ${ground} L955 ${ground - 190} L1010 ${ground} Z" fill="#a9c1d4"/>
  ${house(560, 200, 190, ground)}
  ${house(790, 120, 130, ground)}
  <path d="M0 ${ground - 10} C200 ${ground - 40} 420 ${ground + 10} 640 ${ground - 16} C800 ${ground - 34} 940 ${ground - 4} ${HERO_W} ${ground - 20} V${HERO_H} H0 Z" fill="#fff"/>
  <!-- 拠点の札 -->
  <rect x="520" y="${HERO_H - 120}" width="360" height="92" rx="46" fill="#fff" stroke="${COLORS.winter}" stroke-width="6"/>
  <text x="700" y="${HERO_H - 56}" font-size="58" font-weight="700" fill="${COLORS.ink}" text-anchor="middle">拠点 ${escapeXml(base)}</text>
  <!-- シマエナガとスコップ -->
  <path d="M372 330 L412 520" stroke="#8a6a4a" stroke-width="12" stroke-linecap="round"/>
  <path d="M384 510 L442 494 L458 554 L400 570 Z" fill="${COLORS.lamp}"/>
  ${mascot(110, 300, 2.5)}
</svg>`;
}
