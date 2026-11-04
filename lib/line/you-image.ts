// コンシェルジュの「あなたへ」の画像（1040×676、20:13）。/api/line/hero/you.png
// Claude がその人に合わせて「空・持ち物・ひとこと」を選び（lib/claude/concierge.ts）、絵はここで図形から描く（画像生成 AI は使わない）。
// 載せるのは チームの色と名前・ミッション・分・点・ひとことだけ。氏名・住所・位置は入れない。
import { COLORS } from "../brand";
import { escapeXml } from "../cards/svg";
import { TEAMS } from "../teams";
import type { TeamId } from "../types";
import { HERO_H, HERO_W } from "./hero";

export const SKIES = ["dawn", "morning", "snowy", "night"] as const;
export const PROPS = ["shovel", "phone", "tea", "map", "megaphone", "pencil"] as const;
export type Sky = (typeof SKIES)[number];
export type Prop = (typeof PROPS)[number];

export interface YouImage {
  sky: Sky;
  prop: Prop;
  /** Claude のひとこと（14字まで） */
  caption: string;
  /** ミッションの名前（14字まで） */
  title: string;
  minutes: number;
  /** チームに入る点（なければ 0） */
  points: number;
  teamId?: TeamId;
}

export const CAPTION_MAX = 14;

/** 画像に載せてよい文にそろえる（記号・数字の並び・長すぎを落とす） */
export function cleanCaption(s: string | null | undefined, max = CAPTION_MAX): string {
  return [...(s ?? "").replace(/[<>&"'`{}\\\s]/g, "").replace(/\d{3,}/g, "")].slice(0, max).join("");
}

/** URL の値から、描いてよい形に戻す（変な値は既定に） */
export function youParams(q: URLSearchParams): YouImage {
  const sky = (SKIES as readonly string[]).includes(q.get("sky") ?? "") ? (q.get("sky") as Sky) : "morning";
  const prop = (PROPS as readonly string[]).includes(q.get("p") ?? "") ? (q.get("p") as Prop) : "shovel";
  const team = TEAMS.find((t) => t.id === q.get("t"))?.id;
  const num = (k: string, lo: number, hi: number, d: number) => {
    const n = Number(q.get(k));
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, Math.round(n))) : d;
  };
  return {
    sky,
    prop,
    caption: cleanCaption(q.get("c")) || "あなたの10分を待ってます",
    title: cleanCaption(q.get("m")) || "10分だけ出動",
    minutes: num("min", 1, 60, 10),
    points: num("pt", 0, 15, 0),
    teamId: team,
  };
}

export function youImagePath(img: YouImage): string {
  const q = new URLSearchParams({ sky: img.sky, p: img.prop, c: img.caption, m: img.title, min: String(img.minutes), pt: String(img.points) });
  if (img.teamId) q.set("t", img.teamId);
  return `/api/line/hero/you.png?${q.toString()}`;
}

const SKY: Record<Sky, [string, string, string]> = {
  // 上の色・下の色・遠くの光
  dawn: ["#f6c7a8", "#fbe9da", "#ffd36e"],
  morning: ["#cfe2ee", "#f4f7fa", "#ffffff"],
  snowy: ["#b7c8d6", "#e8eef3", "#ffffff"],
  night: ["#29445c", "#4b6a86", "#ffd36e"],
};

/** シマエナガ（マフラーはチームの色）。x, y は左上、s は倍率（元は 120px） */
function bird(x: number, y: number, s: number, scarf: string): string {
  return `<g transform="translate(${x} ${y}) scale(${s})">
    <path d="M96 70 L116 62 L112 78 Z" fill="#29445c"/>
    <ellipse cx="60" cy="64" rx="44" ry="42" fill="#ffffff" stroke="#dbe6ee" stroke-width="2"/>
    <path d="M88 52 C104 62 104 86 86 96 C90 82 88 66 80 56 Z" fill="#29445c"/>
    <path d="M32 56 C14 50 8 30 18 22 C24 36 32 44 42 50 Z" fill="#3b6584"/>
    <path d="M40 52 Q45 46 50 52" fill="none" stroke="#1d2f40" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M70 52 Q75 46 80 52" fill="none" stroke="#1d2f40" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M56 60 L64 60 L60 66 Z" fill="#1d2f40"/>
    <ellipse cx="36" cy="64" rx="6" ry="3.6" fill="#f2b8bf" opacity="0.85"/>
    <ellipse cx="84" cy="64" rx="6" ry="3.6" fill="#f2b8bf" opacity="0.85"/>
    <path d="M22 76 C40 88 80 88 98 76 L98 86 C80 98 40 98 22 86 Z" fill="${scarf}"/>
    <path d="M70 88 L78 112 L90 108 L84 86 Z" fill="${scarf}" opacity="0.8"/>
  </g>`;
}

/** 持ち物（シマエナガの右手側に置く） */
function prop(kind: Prop): string {
  switch (kind) {
    case "shovel":
      return `<path d="M372 300 L412 500" stroke="#8a6a4a" stroke-width="12" stroke-linecap="round"/><path d="M384 492 L442 476 L458 536 L400 552 Z" fill="${COLORS.lamp}"/>`;
    case "phone":
      return `<rect x="370" y="360" width="84" height="150" rx="16" fill="${COLORS.ink}"/><rect x="380" y="376" width="64" height="104" rx="6" fill="#cfe2ee"/><path d="M398 420 l12 12 l22 -24" stroke="${COLORS.lamp}" stroke-width="8" fill="none" stroke-linecap="round"/>`;
    case "tea":
      return `<path d="M372 430 h80 v50 a40 40 0 0 1 -80 0 Z" fill="#fff" stroke="${COLORS.winter}" stroke-width="6"/><path d="M452 446 a16 16 0 0 1 0 32" fill="none" stroke="${COLORS.winter}" stroke-width="6"/><path d="M392 410 q8 -14 0 -28 M412 410 q8 -14 0 -28 M432 410 q8 -14 0 -28" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/>`;
    case "map":
      return `<path d="M360 380 L392 368 L424 380 L456 368 V470 L424 482 L392 470 L360 482 Z" fill="#fff" stroke="${COLORS.winter}" stroke-width="6" stroke-linejoin="round"/><circle cx="408" cy="420" r="12" fill="${COLORS.lamp}"/>`;
    case "megaphone":
      return `<path d="M366 420 L440 380 V490 L366 450 Z" fill="${COLORS.lamp}"/><rect x="350" y="418" width="20" height="34" rx="6" fill="${COLORS.ink}"/><path d="M458 410 q20 25 0 50" stroke="${COLORS.lamp}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    case "pencil":
      return `<path d="M372 500 L440 380 L462 392 L394 512 Z" fill="#ffd36e" stroke="${COLORS.ink}" stroke-width="5"/><path d="M372 500 L394 512 L368 528 Z" fill="${COLORS.ink}"/>`;
  }
}

export function renderYouSvg(img: YouImage): string {
  const [top, bottom, glow] = SKY[img.sky];
  const team = img.teamId ? TEAMS.find((t) => t.id === img.teamId) : undefined;
  const scarf = team?.color ?? COLORS.lamp;
  const dark = img.sky === "night";
  const ground = 600;
  const flakes = img.sky === "snowy" || img.sky === "night"
    ? [[90, 120, 7], [230, 210, 5], [520, 150, 6], [700, 230, 5], [860, 130, 7], [980, 260, 5], [140, 330, 5], [610, 300, 4]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="0.9"/>`)
        .join("")
    : `<circle cx="900" cy="120" r="70" fill="${glow}" opacity="0.55"/>`;
  const chip = `${img.minutes}分${img.points > 0 ? ` ・ チーム +${img.points}点` : ""}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${HERO_W}" height="${HERO_H}" viewBox="0 0 ${HERO_W} ${HERO_H}" font-family="Zen Maru Gothic, sans-serif">
  <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient></defs>
  <rect width="${HERO_W}" height="${HERO_H}" fill="url(#sky)"/>
  ${flakes}
  <!-- 家（灯りつき）と雪の地面 -->
  <path d="M640 ${ground - 150} L760 ${ground - 250} L880 ${ground - 150} V${ground} H640 Z" fill="${dark ? "#3b5873" : "#c9d8e4"}"/>
  <path d="M628 ${ground - 146} L760 ${ground - 258} L892 ${ground - 146}" fill="none" stroke="#fff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
  <rect x="736" y="${ground - 120}" width="48" height="40" rx="6" fill="#f3c48a"/>
  <path d="M0 ${ground - 10} C220 ${ground - 44} 460 ${ground + 8} 680 ${ground - 18} C830 ${ground - 36} 960 ${ground - 6} ${HERO_W} ${ground - 22} V${HERO_H} H0 Z" fill="#fff"/>
  <!-- ひとこと（Claude）: 吹き出し -->
  <rect x="40" y="36" width="${HERO_W - 80}" height="132" rx="34" fill="#fff" stroke="${scarf}" stroke-width="8"/>
  <path d="M220 166 L250 210 L280 166 Z" fill="#fff" stroke="${scarf}" stroke-width="8" stroke-linejoin="round"/>
  <rect x="226" y="150" width="50" height="20" fill="#fff"/>
  <text x="${HERO_W / 2}" y="124" font-size="${[...img.caption].length > 11 ? 52 : 60}" font-weight="700" fill="${COLORS.ink}" text-anchor="middle">${escapeXml(img.caption)}</text>
  <!-- シマエナガと持ち物 -->
  ${prop(img.prop)}
  ${bird(100, 250, 2.4, scarf)}
  <!-- ミッションの札 -->
  <rect x="470" y="${HERO_H - 168}" width="530" height="140" rx="30" fill="${COLORS.ink}"/>
  <text x="735" y="${HERO_H - 104}" font-size="${[...img.title].length > 10 ? 40 : 46}" font-weight="700" fill="#fff" text-anchor="middle">${escapeXml(img.title)}</text>
  <text x="735" y="${HERO_H - 52}" font-size="36" font-weight="700" fill="#ffd36e" text-anchor="middle">${escapeXml(chip)}</text>
  ${team ? `<text x="60" y="${HERO_H - 30}" font-size="30" font-weight="700" fill="${scarf}">${escapeXml(team.name)}のあなたへ</text>` : ""}
</svg>`;
}
