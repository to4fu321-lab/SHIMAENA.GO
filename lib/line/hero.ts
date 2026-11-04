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
function mascot(x: number, y: number, s: number, cap = false): string {
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
    ${cap ? CAP : ""}
  </g>`;
}

/** 隊長の帽子（紺に雪の結晶のバッジ） */
const CAP = `
    <path d="M26 36 C30 8 90 8 94 36 Z" fill="#29445c"/>
    <path d="M18 36 Q60 46 102 36 L100 44 Q60 54 20 44 Z" fill="#1d2f40"/>
    <circle cx="60" cy="24" r="8" fill="#ffd36e"/>
    <path d="M60 18 V30 M54.8 21 L65.2 27 M54.8 27 L65.2 21" stroke="#29445c" stroke-width="1.8" stroke-linecap="round"/>`;

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

// ---- 隊長カードの画像（予告・朝のあいさつ）: /api/line/hero/snow.png?cm=12&s=ぼた雪のドンブリ&w=eve ----

export interface SnowLevel {
  /** 難しさ（1〜4） */
  stars: number;
  label: string;
  /** 隊長のひとこと（吹き出し。11字くらいまで） */
  cheer: string;
}

/** 積雪で難しさとひとことを決める。雪が多いほど盛り上げる（怖がらせない） */
export function snowLevel(cm: number): SnowLevel {
  if (cm < 8) return { stars: 1, label: "こな雪", cheer: "サクッといくしま〜！" };
  if (cm < 15) return { stars: 2, label: "ふつうの雪", cheer: "みんなで10分えな〜！" };
  if (cm < 25) return { stars: 3, label: "大雪", cheer: "出番だしま〜！！" };
  return { stars: 4, label: "ボス級の大雪", cheer: "群れの力だしま〜！" };
}

/** URL から来た値をそろえる。雪の名前は 8 字まで（記号は外す） */
export function snowParams(cm: string | null, name: string | null, when: string | null): { cm: number; name: string; when: "eve" | "morning" } {
  const n = Number(cm);
  return {
    cm: Number.isFinite(n) ? Math.max(0, Math.min(200, Math.round(n))) : 0,
    name: (name ?? "").replace(/[<>&"'「」『』\s]/g, "").slice(0, 8),
    when: when === "morning" ? "morning" : "eve",
  };
}

/** 画像の URL（雪の名前は Claude がつけた名前。人の名前・住所は入れない） */
export function snowHeroPath(cm: number, name: string | undefined, when: "eve" | "morning"): string {
  const q = new URLSearchParams({ cm: String(cm), w: when });
  if (name) q.set("s", name);
  return `/api/line/hero/snow.png?${q.toString()}`;
}

export function renderSnowSvg(cm: number, name: string, when: "eve" | "morning"): string {
  const lv = snowLevel(cm);
  const heavy = lv.stars >= 3;
  // 雪が多いほど空は夕焼けの灯り色に、雪のつぶは多く大きく
  const sky = lv.stars === 4 ? ["#3b6584", "#d9825b"] : heavy ? ["#8fb8c9", "#f5d6bf"] : ["#cfe2ee", "#f4f7fa"];
  const count = 8 + lv.stars * 8;
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const flakes = Array.from({ length: count }, () => {
    const x = 240 + rnd() * 780;
    const y = 170 + rnd() * 380;
    const r = 3 + rnd() * (2 + lv.stars * 1.6);
    return `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r.toFixed(1)}" fill="#fff" opacity="0.9"/>`;
  }).join("");
  // 積雪ゲージ: 40cm で満タン（10px = 1cm）
  const gx = 70, gTop = 200, gBottom = 600, per = 10;
  const fill = Math.min(cm, 40) * per;
  const ticks = [10, 20, 30, 40]
    .map((t) => `<path d="M${gx + 90} ${gBottom - t * per} h18" stroke="${COLORS.ink}" stroke-width="4"/><text x="${gx + 116}" y="${gBottom - t * per + 10}" font-size="26" font-weight="700" fill="${COLORS.ink}">${t}</text>`)
    .join("");
  const stars = Array.from({ length: 4 }, (_, i) => `<text x="${770 + i * 62}" y="112" font-size="56" fill="${i < lv.stars ? "#ffd36e" : "#5b7590"}">★</text>`).join("");
  const rays = heavy
    ? Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        const cx = 816, cy = 466;
        return `<path d="M${(cx + Math.cos(a) * 150).toFixed(0)} ${(cy + Math.sin(a) * 150).toFixed(0)} L${(cx + Math.cos(a) * 240).toFixed(0)} ${(cy + Math.sin(a) * 240).toFixed(0)}" stroke="#ffd36e" stroke-width="10" stroke-linecap="round" opacity="0.85"/>`;
      }).join("")
    : "";
  const title = name ? `『${escapeXml(name)}』` : lv.label;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${HERO_W}" height="${HERO_H}" viewBox="0 0 ${HERO_W} ${HERO_H}" font-family="Zen Maru Gothic, sans-serif">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky[0]}"/><stop offset="1" stop-color="${sky[1]}"/></linearGradient></defs>
  <rect width="${HERO_W}" height="${HERO_H}" fill="url(#sky)"/>
  ${flakes}
  <!-- 上の帯: 相手の雪の名前と難しさ -->
  <rect width="${HERO_W}" height="150" fill="${COLORS.ink}"/>
  <text x="48" y="58" font-size="32" font-weight="700" fill="#cfe2ee">${when === "eve" ? "明日の朝の相手" : "今朝の相手"}</text>
  <text x="40" y="126" font-size="${name ? 60 : 64}" font-weight="700" fill="#ffd36e">${title}</text>
  ${stars}
  <!-- 積雪ゲージ -->
  <rect x="${gx}" y="${gTop}" width="90" height="${gBottom - gTop}" rx="16" fill="${COLORS.ink}" fill-opacity="0.18" stroke="${COLORS.ink}" stroke-width="5"/>
  <rect x="${gx + 5}" y="${gBottom - fill}" width="80" height="${fill}" rx="12" fill="#ffffff"/>
  <path d="M${gx + 5} ${gBottom - fill + 8} q20 -16 40 0 t40 0" fill="#fff" stroke="${COLORS.ice}" stroke-width="4"/>
  ${cm > 40 ? `<text x="${gx + 45}" y="${gTop - 14}" font-size="40" font-weight="700" fill="${COLORS.lamp}" text-anchor="middle">↑</text>` : ""}
  ${ticks}
  <rect x="228" y="236" width="320" height="270" rx="32" fill="#fff" opacity="0.88"/>
  <text x="250" y="380" font-size="150" font-weight="700" fill="${COLORS.ink}">${cm}</text>
  <text x="${250 + String(cm).length * 84}" y="380" font-size="60" font-weight="700" fill="${COLORS.ink}">cm</text>
  <rect x="250" y="410" width="${lv.label.length * 44 + 48}" height="70" rx="35" fill="${heavy ? COLORS.lamp : COLORS.winter}"/>
  <text x="${274}" y="460" font-size="44" font-weight="700" fill="#fff">${lv.label}</text>
  <!-- 隊長 -->
  ${rays}
  <rect x="560" y="176" width="460" height="86" rx="43" fill="#fff" stroke="${COLORS.ink}" stroke-width="5"/>
  <path d="M760 258 L790 300 L800 258 Z" fill="#fff" stroke="${COLORS.ink}" stroke-width="5" stroke-linejoin="round"/>
  <rect x="762" y="250" width="34" height="12" fill="#fff"/>
  <text x="790" y="235" font-size="44" font-weight="700" fill="${heavy ? COLORS.lamp : COLORS.ink}" text-anchor="middle">${escapeXml(lv.cheer)}</text>
  ${mascot(660, 300, 2.6, true)}
  <path d="M0 ${HERO_H - 40} C260 ${HERO_H - 70} 600 ${HERO_H - 20} ${HERO_W} ${HERO_H - 56} V${HERO_H} H0 Z" fill="#fff"/>
</svg>`;
}
