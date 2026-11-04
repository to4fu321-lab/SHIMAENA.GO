// ありがとうカードを SVG で描く（spec 7）。絵は画像生成AIを使わず、ここで図形から組み立てる。
// 基本は「パステル×ネオン×メンフィス柄のかわいいシティポップ」。レアでタッチが変わる。
// 並ぶシマエナガの数＝来た人数、耳あての色＝その人のチーム色。右上に消印。お宅の名前は載せない。
import { sceneLayer, type CardScene } from "./scene";
import { TEAMS } from "../teams";
import type { CardStyle, TeamId } from "../types";

export interface CardArt {
  style: CardStyle;
  designName: string;
  designNameEn: string;
  rarityLabel: string;
  stars: 1 | 2 | 3;
  /** 並ぶ人。teamId がない人（ソロ出動の依頼者など）は耳あてがうす紫 */
  members: { name: string; teamId?: TeamId }[];
  date: string; // YYYY-MM-DD
  townName: string;
  snowKg: number;
  snowKgComparison: string;
  /** v1.8: 排雪 kg の計算の元（裏面に小さく。例: 写真から約20〜30cm × 玄関前 12m² × 重い湿り雪） */
  snowKgBasis?: string;
  serial: number;
  issuedCount: number;
  /** 絵の中の英語のひとこと */
  flavor?: string;
  /** 消印の真ん中の文字（既定は排雪 kg。ソロ出動のカードは「ソロ」など） */
  stampText?: string;
  /** v1.8: その時だけの場面（空・降る雪・積もった雪・持ち物・雰囲気・なぜこの絵か・設計図の番号） */
  scene?: CardScene;
}

export const CARD_W = 600;
export const CARD_H = 840;
const JP = "Zen Maru Gothic, Noto Sans JP, sans-serif";
const EN = "Georgia, Zen Maru Gothic, serif";

export function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

const teamColor = (id?: TeamId) => TEAMS.find((t) => t.id === id)?.color ?? "#8a7bb5";
const teamName = (id: TeamId) => TEAMS.find((t) => t.id === id)?.name ?? id;

const WEEK = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
export function dateLabel(ymd: string): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  return `${ymd.replace(/-/g, ".")} ${WEEK[d.getUTCDay()]}`;
}

function teamsLabel(members: CardArt["members"]): string {
  const ids: TeamId[] = [];
  for (const m of members) if (m.teamId && !ids.includes(m.teamId)) ids.push(m.teamId);
  return ids.length > 0 ? ids.map(teamName).join(" × ") : "ソロ出動";
}

function stars(n: number): string {
  return "★".repeat(n);
}

/** 来た人の数だけ並べる位置（最大6羽、中央寄せ） */
function spread(n: number, left: number, right: number): number[] {
  const count = Math.max(1, Math.min(6, n));
  if (count === 1) return [(left + right) / 2];
  const step = (right - left) / (count - 1);
  return Array.from({ length: count }, (_, i) => left + step * i);
}

const birdScale = (n: number) => (n <= 3 ? 1 : n === 4 ? 0.88 : 0.74);

// ---- 消印（右上） ----
export const STAMP_START = "<!--stamp-->";
export const STAMP_END = "<!--/stamp-->";
/** 消印を外した絵（演出で、あとから動くスタンプを押すため） */
export function withoutStamp(svg: string): string {
  const a = svg.indexOf(STAMP_START);
  const b = svg.indexOf(STAMP_END);
  return a >= 0 && b > a ? svg.slice(0, a) + svg.slice(b + STAMP_END.length) : svg;
}
function stamp(art: CardArt, color: string, paper: string): string {
  // 印（STAMP_START〜STAMP_END）: 完了画面の演出では、この部分を外した絵に、動くスタンプを押す（/api/cards/<id>/front.png?stamp=0）
  return `${STAMP_START}
  <g transform="translate(494 96) rotate(-12)">
    <circle cx="0" cy="0" r="60" fill="${paper}" opacity="0.8"/>
    <circle cx="0" cy="0" r="60" fill="none" stroke="${color}" stroke-width="4"/>
    <circle cx="0" cy="0" r="44" fill="none" stroke="${color}" stroke-width="2"/>
    <path id="aT" d="M-50 0 A50 50 0 0 1 50 0" fill="none"/><path id="aB" d="M-50 0 A50 50 0 0 0 50 0" fill="none"/>
    <text font-family="${JP}" font-size="12" font-weight="700" fill="${color}" letter-spacing="2"><textPath href="#aT" startOffset="50%" text-anchor="middle">${escapeXml(art.townName)}</textPath></text>
    <text font-family="${JP}" font-size="11" font-weight="700" fill="${color}" letter-spacing="2"><textPath href="#aB" startOffset="50%" text-anchor="middle">${escapeXml(art.date.replace(/-/g, "."))}</textPath></text>
    <text x="0" y="2" font-family="${JP}" font-size="24" font-weight="700" fill="${color}" text-anchor="middle">${escapeXml(art.stampText ?? `${art.snowKg}kg`)}</text>
    <text x="0" y="24" font-family="${JP}" font-size="13" font-weight="700" fill="${color}" text-anchor="middle" letter-spacing="1">No.${String(art.serial).padStart(3, "0")}/${art.issuedCount}</text>
    <g stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round">
      <path d="M-136 -22 q12 -6 24 0 t24 0 t24 0"/><path d="M-136 -7 q12 -6 24 0 t24 0 t24 0"/><path d="M-136 8 q12 -6 24 0 t24 0 t24 0"/><path d="M-136 23 q12 -6 24 0 t24 0 t24 0"/>
    </g>
  </g>${STAMP_END}`;
}

// ---- ホログラム風（レアだけ。SVG で見るときだけ動く） ----
function holo(): string {
  return `
  <g clip-path="url(#pic)" opacity="0.22" style="mix-blend-mode:screen">
    <rect x="-300" y="-100" width="140" height="900" fill="url(#holoGrad)" transform="rotate(20 300 300)">
      <animateTransform attributeName="transform" type="translate" from="-200 0" to="1000 0" dur="4s" repeatCount="indefinite" additive="sum"/>
    </rect>
  </g>`;
}
const HOLO_DEF = `<linearGradient id="holoGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.4" stop-color="#9be7ff"/><stop offset="0.5" stop-color="#fff"/><stop offset="0.6" stop-color="#ffb3d9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;

// ---- 情報欄（下）: 各タッチで色だけ変える ----
interface InfoColors {
  pill: string;
  pillText: string;
  title: string;
  subtitle: string;
  names: string;
  meta: string;
  font?: string;
}
function info(art: CardArt, c: InfoColors): string {
  const font = c.font ?? JP;
  const pill = `${art.rarityLabel} ${stars(art.stars)} ・ ${art.issuedCount}枚限定`;
  const names = art.members.map((m) => m.name).join("・");
  return `
  <rect x="330" y="612" width="240" height="30" rx="15" fill="${c.pill}"/>
  <text x="450" y="633" font-family="${font}" font-size="14" font-weight="700" fill="${c.pillText}" text-anchor="middle" letter-spacing="1">${escapeXml(pill)}</text>
  <text x="60" y="662" font-family="${font}" font-size="${art.designName.length > 9 ? 26 : 32}" font-weight="700" fill="${c.title}" letter-spacing="2">${escapeXml(art.designName)}</text>
  <text x="60" y="692" font-family="${EN}" font-style="italic" font-size="18" fill="${c.subtitle}" letter-spacing="1">${escapeXml(art.designNameEn)}</text>
  <text x="60" y="734" font-family="${font}" font-size="${names.length > 16 ? 15 : 18}" fill="${c.names}">${escapeXml(names)}</text>
  <text x="60" y="762" font-family="${font}" font-size="14" fill="${c.meta}" letter-spacing="1">${escapeXml(dateLabel(art.date))} ｜ ${escapeXml(teamsLabel(art.members))}</text>
  <text x="60" y="808" font-family="${font}" font-size="11" fill="${c.meta}" opacity="0.8" letter-spacing="2">この時だけ ${art.issuedCount} 枚発行 ・ 排雪 ${art.snowKg}kg（${escapeXml(art.snowKgComparison)}） ・ #シマエナGO</text>`;
}

// ---- 1. かわいいシティポップ（基本） ----
export function kawaiiBird(x: number, y: number, s: number, ear: string): string {
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="40" rx="44" ry="10" fill="#9fb8d8" opacity="0.4"/>
    <ellipse cx="0" cy="0" rx="46" ry="42" fill="#fff" stroke="#8a7bb5" stroke-width="2.5"/>
    <circle cx="-14" cy="-6" r="4" fill="#3b2a78"/><circle cx="14" cy="-6" r="4" fill="#3b2a78"/>
    <path d="M-4 8 L4 8 L0 13 Z" fill="#3b2a78"/>
    <ellipse cx="-26" cy="10" rx="9" ry="6" fill="#ffb3d9"/><ellipse cx="26" cy="10" rx="9" ry="6" fill="#ffb3d9"/>
    <path d="M-40 -14 q40 -34 80 0" stroke="#8a7bb5" stroke-width="3" fill="none"/>
    <circle cx="-43" cy="-13" r="9" fill="${ear}" stroke="#8a7bb5" stroke-width="2"/>
    <circle cx="43" cy="-13" r="9" fill="${ear}" stroke="#8a7bb5" stroke-width="2"/>
    <path d="M-30 28 q30 18 60 0 l0 12 q-30 18 -60 0 z" fill="#7af0d7" stroke="#8a7bb5" stroke-width="2"/>
  </g>`;
}

function kawaii(art: CardArt): string {
  const n = art.members.length;
  const xs = spread(n, 130, 470);
  const s = birdScale(n);
  const birds = art.members
    .slice(0, 6)
    .map((m, i) => kawaiiBird(xs[i], 505 + (i % 2) * 6, s, teamColor(m.teamId)))
    .join("");
  const flavor = escapeXml(art.flavor ?? "Have a nice snow day!");
  return `
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb3d9"/><stop offset="0.5" stop-color="#cdbaff"/><stop offset="1" stop-color="#9fe8e1"/></linearGradient>
    <linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4fcf"/><stop offset="1" stop-color="#2fb5c9"/></linearGradient>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <clipPath id="pic"><rect x="30" y="30" width="540" height="560" rx="26"/></clipPath>
    ${HOLO_DEF}
  </defs>
  <rect width="600" height="840" rx="28" fill="#fff6fb"/>
  <g clip-path="url(#pic)">
    <rect x="30" y="30" width="540" height="560" fill="url(#night)"/>
    <rect x="30" y="30" width="540" height="560" fill="url(#bg)" opacity="0.55"/>
    <g fill="#fff" opacity="0.18"><circle cx="120" cy="120" r="40"/><circle cx="470" cy="200" r="55"/><circle cx="300" cy="90" r="30"/><circle cx="90" cy="330" r="48"/><circle cx="520" cy="360" r="36"/></g>
    <g fill="none" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
      <path d="M60 250 l18 -22 l18 22 l18 -22 l18 22" stroke="#ff7ab8"/>
      <path d="M430 100 l16 -20 l16 20 l16 -20 l16 20" stroke="#fff27a"/>
      <path d="M90 440 q10 -14 20 0 t20 0 t20 0" stroke="#7af0d7"/>
      <path d="M480 450 q10 -14 20 0 t20 0 t20 0" stroke="#ff7ab8"/>
      <polygon points="520,130 540,165 500,165" stroke="#7af0d7" fill="#7af0d7" opacity="0.9"/>
      <polygon points="70,160 86,190 54,190" stroke="#ff7ab8" fill="none"/>
      <circle cx="400" cy="60" r="9" stroke="#fff" fill="none"/>
      <rect x="140" y="60" width="18" height="18" stroke="#fff27a" fill="#fff27a" transform="rotate(20 149 69)"/>
    </g>
    <g stroke="#fff" stroke-width="2.5" stroke-linecap="round" filter="url(#glow)"><path d="M380 150 l70 -30"/><path d="M110 60 l55 -18"/><path d="M470 290 l-8 0 M466 286 l0 8" stroke-width="3"/><path d="M160 300 l-10 0 M155 295 l0 10" stroke-width="3"/></g>
    <g fill="#fff27a" filter="url(#glow)"><polygon points="450,120 455,132 468,133 458,141 461,154 450,147 439,154 442,141 432,133 445,132"/><polygon points="150,130 153,138 162,139 155,144 157,153 150,148 143,153 145,144 138,139 147,138" fill="#ff7ab8"/></g>
    <g filter="url(#glow)">
      <text x="225" y="150" font-family="${EN}" font-style="italic" font-size="56" fill="#fff" stroke="#ff7ab8" stroke-width="2" text-anchor="middle">Shimaena</text>
      <text x="285" y="208" font-family="${EN}" font-style="italic" font-size="50" fill="#fff" stroke="#7af0d7" stroke-width="2" text-anchor="middle">GO!</text>
      <path d="M185 192 q28 14 56 0" stroke="#fff27a" stroke-width="3" fill="none"/>
    </g>
    <g filter="url(#glow)">
      <path d="M376 230 h170 a10 10 0 0 1 10 10 v36 a10 10 0 0 1 -10 10 h-130 l-18 14 v-14 h-22 a10 10 0 0 1 -10 -10 v-36 a10 10 0 0 1 10 -10 z" fill="none" stroke="#fff27a" stroke-width="2.5"/>
      <text x="461" y="265" font-family="${EN}" font-style="italic" font-size="17" fill="#fff27a" text-anchor="middle">${flavor}</text>
    </g>
    <g fill="#3b2a78" opacity="0.75">
      <rect x="30" y="330" width="60" height="140"/><rect x="95" y="300" width="45" height="170"/><rect x="145" y="340" width="70" height="130"/>
      <rect x="220" y="290" width="50" height="180"/><rect x="275" y="320" width="80" height="150"/><rect x="360" y="300" width="40" height="170"/>
      <rect x="405" y="340" width="75" height="130"/><rect x="485" y="310" width="50" height="160"/><rect x="540" y="350" width="40" height="120"/>
    </g>
    <g fill="#fff27a" opacity="0.9">
      <rect x="40" y="345" width="6" height="8"/><rect x="60" y="360" width="6" height="8"/><rect x="104" y="315" width="6" height="8"/><rect x="124" y="340" width="6" height="8"/>
      <rect x="160" y="355" width="6" height="8"/><rect x="190" y="370" width="6" height="8"/><rect x="232" y="305" width="6" height="8"/><rect x="250" y="330" width="6" height="8"/>
      <rect x="290" y="335" width="6" height="8"/><rect x="330" y="350" width="6" height="8"/><rect x="372" y="315" width="6" height="8"/><rect x="420" y="355" width="6" height="8"/>
      <rect x="455" y="372" width="6" height="8"/><rect x="498" y="325" width="6" height="8"/><rect x="552" y="365" width="6" height="8"/><rect x="310" y="380" width="6" height="8"/>
    </g>
    <rect x="30" y="470" width="540" height="120" fill="#e9f3ff"/>
    <g stroke="#7af0d7" stroke-width="1.5" opacity="0.9">
      <line x1="30" y1="500" x2="570" y2="500"/><line x1="30" y1="530" x2="570" y2="530"/><line x1="30" y1="565" x2="570" y2="565"/>
      <line x1="300" y1="470" x2="300" y2="590"/><line x1="300" y1="470" x2="150" y2="590"/><line x1="300" y1="470" x2="450" y2="590"/>
      <line x1="300" y1="470" x2="0" y2="590"/><line x1="300" y1="470" x2="600" y2="590"/>
    </g>
    ${birds}
    <g transform="translate(530 478) rotate(18)"><rect x="-4" y="-56" width="8" height="78" rx="3" fill="#8a7bb5"/><path d="M-18 18 h36 l-5 30 h-26 z" fill="#ff7ab8" stroke="#8a7bb5" stroke-width="2"/></g>
    <text x="300" y="582" font-family="${EN}" font-style="italic" font-size="14" fill="#6b4fcf" text-anchor="middle">City pop na Shimaenaga.</text>
  </g>
  ${art.scene ? sceneLayer(art.scene) : ""}
  ${art.stars >= 2 ? holo() : ""}
  <rect x="30" y="30" width="540" height="560" rx="26" fill="none" stroke="#fff" stroke-width="6"/>
  <rect x="30" y="30" width="540" height="560" rx="26" fill="none" stroke="#cdbaff" stroke-width="2"/>
  ${stamp(art, "#d81b60", "#fff6fb")}
  ${info(art, { pill: "#ffb3d9", pillText: "#6b4fcf", title: "#6b4fcf", subtitle: "#ff4f8b", names: "#3b2a78", meta: "#8a7bb5" })}`;
}

// ---- 2. 80s レトロウェーブ（早朝） ----
function neonBird(x: number, y: number, s: number, ear: string): string {
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="0" rx="30" ry="26" fill="#fff8f2" stroke="#ff4f8b" stroke-width="3" filter="url(#neon)"/>
    <circle cx="-8" cy="-4" r="3" fill="#140a2e"/><circle cx="8" cy="-4" r="3" fill="#140a2e"/>
    <path d="M-3 5 L3 5 L0 9 Z" fill="#140a2e"/>
    <path d="M20 8 L46 30" stroke="#140a2e" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="-16" cy="9" rx="10" ry="6" fill="#ffd1dc"/>
    <path d="M-26 -10 q26 -24 52 0" stroke="#2ee6ff" stroke-width="2.5" fill="none" filter="url(#neon)"/>
    <circle cx="-27" cy="-8" r="6" fill="${ear}" stroke="#2ee6ff" stroke-width="2"/><circle cx="27" cy="-8" r="6" fill="${ear}" stroke="#2ee6ff" stroke-width="2"/>
  </g>`;
}

function retrowave(art: CardArt): string {
  const n = art.members.length;
  const xs = spread(n, 150, 450);
  const s = birdScale(n);
  const birds = art.members.slice(0, 6).map((m, i) => neonBird(xs[i], 258 + (i % 2) * 4, s, teamColor(m.teamId))).join("");
  return `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#140a2e"/><stop offset="0.45" stop-color="#5b1d6e"/><stop offset="0.75" stop-color="#ff4f8b"/><stop offset="1" stop-color="#ffb36b"/></linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff176"/><stop offset="0.6" stop-color="#ff8a5c"/><stop offset="1" stop-color="#ff3d7f"/></linearGradient>
    <linearGradient id="snow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a1550"/><stop offset="1" stop-color="#0d0620"/></linearGradient>
    <linearGradient id="chrome" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.48" stop-color="#9be7ff"/><stop offset="0.52" stop-color="#1b7fc4"/><stop offset="1" stop-color="#e6fbff"/></linearGradient>
    <filter id="neon" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="2" fill="#000" opacity="0.12"/></pattern>
    <clipPath id="sunclip"><circle cx="300" cy="330" r="120"/></clipPath>
    <clipPath id="pic"><rect x="30" y="30" width="540" height="560" rx="18"/></clipPath>
    ${HOLO_DEF}
  </defs>
  <rect width="600" height="840" rx="28" fill="#0b0618"/>
  <rect x="14" y="14" width="572" height="812" rx="22" fill="none" stroke="#ff4f8b" stroke-width="2"/>
  <rect x="22" y="22" width="556" height="796" rx="18" fill="none" stroke="#2ee6ff" stroke-width="1" opacity="0.7"/>
  <g clip-path="url(#pic)">
    <rect x="30" y="30" width="540" height="560" fill="url(#sky)"/>
    <g fill="#fff"><circle cx="90" cy="90" r="1.8"/><circle cx="170" cy="60" r="1.2"/><circle cx="420" cy="80" r="1.6"/><circle cx="520" cy="130" r="1.3"/><circle cx="260" cy="110" r="1.1"/><circle cx="480" cy="200" r="1.4"/><circle cx="70" cy="210" r="1.2"/><circle cx="360" cy="150" r="1"/></g>
    <g clip-path="url(#sunclip)">
      <circle cx="300" cy="330" r="120" fill="url(#sun)"/>
      <g fill="#140a2e"><rect x="150" y="330" width="300" height="6"/><rect x="150" y="350" width="300" height="9"/><rect x="150" y="375" width="300" height="12"/><rect x="150" y="405" width="300" height="16"/><rect x="150" y="440" width="300" height="22"/></g>
    </g>
    <path d="M30 420 L130 340 L210 400 L300 330 L390 410 L470 350 L570 420" fill="none" stroke="#2ee6ff" stroke-width="3" filter="url(#neon)"/>
    <path d="M30 420 L130 340 L210 400 L300 330 L390 410 L470 350 L570 420 L570 460 L30 460 Z" fill="#1b0f3a"/>
    <rect x="30" y="440" width="540" height="150" fill="url(#snow)"/>
    <g stroke="#ff4f8b" stroke-width="1.5" opacity="0.9" filter="url(#neon)">
      <line x1="30" y1="470" x2="570" y2="470"/><line x1="30" y1="495" x2="570" y2="495"/><line x1="30" y1="528" x2="570" y2="528"/><line x1="30" y1="570" x2="570" y2="570"/>
      <line x1="300" y1="440" x2="300" y2="590"/><line x1="300" y1="440" x2="120" y2="590"/><line x1="300" y1="440" x2="480" y2="590"/><line x1="300" y1="440" x2="-60" y2="590"/><line x1="300" y1="440" x2="660" y2="590"/>
    </g>
    <path d="M270 590 L292 440 L308 440 L330 590 Z" fill="#2ee6ff" opacity="0.85" filter="url(#neon)"/>
    <g stroke-linecap="round">
      <path d="M70 590 L80 300" stroke="#f4f4f4" stroke-width="10"/><path d="M72 540 h12 M74 480 h12 M76 420 h12 M78 360 h12" stroke="#1b0f3a" stroke-width="4"/>
      <path d="M530 590 L520 320" stroke="#f4f4f4" stroke-width="9"/><path d="M528 540 h-12 M526 470 h-12 M524 400 h-12" stroke="#1b0f3a" stroke-width="4"/>
    </g>
    <path d="M60 300 Q200 270 380 285 Q470 292 540 318" stroke="#f4f4f4" stroke-width="7" fill="none" stroke-linecap="round"/>
    ${birds}
    <rect x="30" y="30" width="540" height="560" fill="url(#scan)"/>
  </g>
  ${art.scene ? sceneLayer(art.scene) : ""}
  ${holo()}
  ${stamp(art, "#2ee6ff", "#140a2e")}
  ${info(art, { pill: "#140a2e", pillText: "#2ee6ff", title: "#ff4f8b", subtitle: "#9be7ff", names: "#ffd1dc", meta: "#bfa9d9" })}`;
}

// ---- 3. 切り絵（大雪） ----
function paperBird(x: number, y: number, s: number, ear: string): string {
  return `
  <g transform="translate(${x} ${y}) scale(${s})" filter="url(#paper)">
    <ellipse cx="0" cy="0" rx="34" ry="29" fill="#f4efe6"/>
    <circle cx="-9" cy="-5" r="3.5" fill="#1d2b53"/><circle cx="9" cy="-5" r="3.5" fill="#1d2b53"/>
    <path d="M-3 5 L3 5 L0 10 Z" fill="#1d2b53"/>
    <path d="M26 6 L62 30" stroke="#f4efe6" stroke-width="7" stroke-linecap="round"/>
    <path d="M-30 -12 q30 -26 60 0" stroke="#1d2b53" stroke-width="3" fill="none"/>
    <circle cx="-31" cy="-10" r="7" fill="${ear}"/><circle cx="31" cy="-10" r="7" fill="${ear}"/>
  </g>`;
}

function kirie(art: CardArt): string {
  const n = art.members.length;
  const xs = spread(n, 130, 440);
  const s = birdScale(n);
  const birds = art.members.slice(0, 6).map((m, i) => paperBird(xs[i], 116 + (i % 2) * 6, s, teamColor(m.teamId))).join("");
  return `
  <defs>
    <filter id="paper" x="-5%" y="-5%" width="110%" height="115%"><feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000" flood-opacity="0.35"/></filter>
    <clipPath id="pic"><rect x="30" y="30" width="540" height="560" rx="6"/></clipPath>
    ${HOLO_DEF}
  </defs>
  <rect width="600" height="840" fill="#f4efe6"/>
  <g clip-path="url(#pic)">
    <rect x="30" y="30" width="540" height="560" fill="#1d2b53"/>
    <circle cx="420" cy="170" r="70" fill="#f4efe6"/>
    <path d="M30 380 L120 290 L200 350 L300 260 L400 350 L480 300 L570 370 L570 600 L30 600 Z" fill="#2f4b86" filter="url(#paper)"/>
    <path d="M30 430 L110 370 L210 420 L300 360 L390 430 L470 390 L570 440 L570 600 L30 600 Z" fill="#5f7fbf" filter="url(#paper)"/>
    <g fill="#f4efe6" filter="url(#paper)">
      <path d="M70 470 L70 430 L105 400 L140 430 L140 470 Z"/><path d="M430 470 L430 425 L470 390 L510 425 L510 470 Z"/>
      <rect x="92" y="445" width="12" height="25" fill="#1d2b53"/><rect x="462" y="440" width="12" height="30" fill="#1d2b53"/>
    </g>
    <path d="M30 470 Q300 440 570 475 L570 600 L30 600 Z" fill="#f4efe6" filter="url(#paper)"/>
    <path d="M262 600 L290 478 L312 478 L340 600 Z" fill="#1d2b53"/>
    <path d="M30 150 Q200 120 340 140 Q450 155 570 200" stroke="#1d2b53" stroke-width="16" fill="none" stroke-linecap="round" filter="url(#paper)"/>
    <path d="M30 150 Q200 120 340 140 Q450 155 570 200" stroke="#f4efe6" stroke-width="7" fill="none" stroke-linecap="round"/>
    ${birds}
    <g fill="#f4efe6" opacity="0.9"><circle cx="90" cy="230" r="4"/><circle cx="520" cy="80" r="3"/><circle cx="360" cy="230" r="3.5"/><circle cx="500" cy="300" r="3"/><circle cx="140" cy="330" r="3"/><circle cx="250" cy="200" r="3"/><circle cx="60" cy="420" r="3"/></g>
  </g>
  ${art.scene ? sceneLayer(art.scene) : ""}
  ${holo()}
  <rect x="30" y="30" width="540" height="560" rx="6" fill="none" stroke="#1d2b53" stroke-width="3"/>
  ${stamp(art, "#b3261e", "#f4efe6")}
  ${info(art, { pill: "#1d2b53", pillText: "#f4efe6", title: "#1d2b53", subtitle: "#5f7fbf", names: "#1d2b53", meta: "#555" })}`;
}

// ---- 4. ドット絵（連続5日） ----
const PX = 10;
const BIRD_BITMAP = [
  "..EWWWWWE..",
  ".WWWWWWWWW.",
  "WWWBWWWBWWW",
  "WWWWWWWWWWW",
  "WPWWWKWWWPW",
  ".WWWWWWWWW.",
  "..WWWWWWW..",
  "...TTTTT...",
];
function pixelBird(x: number, y: number, ear: string): string {
  const colors: Record<string, string> = { W: "#ffffff", B: "#0e1430", P: "#ff9ec4", K: "#0e1430", T: "#6ee7e0", E: ear };
  const rects: string[] = [];
  BIRD_BITMAP.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === ".") return;
      rects.push(`<rect x="${x + c * PX}" y="${y + r * PX}" width="${PX}" height="${PX}" fill="${colors[ch]}"/>`);
    });
  });
  return rects.join("");
}

function pixel(art: CardArt): string {
  // ドットの鳥は幅 110px。重ならないように間を 20px あけて中央に並べる（5羽以上は小さくせず詰める）
  const n = Math.min(6, art.members.length);
  const gap = n <= 4 ? 20 : 0;
  const birdW = BIRD_BITMAP[0].length * PX;
  const total = n * birdW + (n - 1) * gap;
  const x0 = Math.round((300 - total / 2) / PX) * PX;
  const birds = art.members
    .slice(0, 6)
    .map((m, i) => pixelBird(x0 + i * (birdW + gap), 410 - (i % 2) * 10, teamColor(m.teamId)))
    .join("");
  // 星（決まった位置）
  const starsPx = [
    [80, 60], [160, 100], [240, 50], [330, 90], [420, 60], [500, 120], [120, 160], [460, 170], [300, 140],
  ]
    .map(([x, y]) => `<rect x="${x}" y="${y}" width="${PX}" height="${PX}" fill="#fff"/>`)
    .join("");
  const houses = [60, 300, 470]
    .map(
      (x) => `
    <rect x="${x}" y="330" width="80" height="60" fill="#5b4bd6"/>
    <rect x="${x - 10}" y="300" width="100" height="30" fill="#ffffff"/>
    <rect x="${x + 10}" y="350" width="20" height="20" fill="#ffe66d"/><rect x="${x + 50}" y="350" width="20" height="20" fill="#ffe66d"/>`,
    )
    .join("");
  return `
  <defs><clipPath id="pic"><rect x="30" y="30" width="540" height="560"/></clipPath>${HOLO_DEF}</defs>
  <rect width="600" height="840" fill="#0e1430"/>
  <g clip-path="url(#pic)" shape-rendering="crispEdges">
    <rect x="30" y="30" width="540" height="560" fill="#1b2a5e"/>
    ${starsPx}
    <rect x="420" y="80" width="60" height="60" fill="#fff6c8"/><rect x="440" y="90" width="20" height="10" fill="#1b2a5e"/>
    ${houses}
    <rect x="30" y="390" width="540" height="200" fill="#eef6ff"/>
    <rect x="30" y="390" width="540" height="10" fill="#bcd6ff"/>
    <rect x="250" y="400" width="100" height="190" fill="#9fd0ff"/>
    ${birds}
    <g fill="#ffffff"><rect x="60" y="440" width="10" height="10"/><rect x="520" y="470" width="10" height="10"/><rect x="200" y="520" width="10" height="10"/><rect x="480" y="540" width="10" height="10"/></g>
  </g>
  ${art.scene ? sceneLayer(art.scene) : ""}
  ${holo()}
  <rect x="30" y="30" width="540" height="560" fill="none" stroke="#9fd0ff" stroke-width="4"/>
  ${stamp(art, "#ff6b9d", "#0e1430")}
  ${info(art, { pill: "#9fd0ff", pillText: "#0e1430", title: "#ffffff", subtitle: "#9fd0ff", names: "#eef6ff", meta: "#9aa8d6" })}`;
}

// ---- 5. 湾岸ポップ（鈴木英人系・混成） ----
function flatBird(x: number, y: number, s: number, ear: string): string {
  return `
  <g transform="translate(${x} ${y}) scale(${s})">
    <ellipse cx="0" cy="0" rx="30" ry="26" fill="#fff" stroke="#1a1a1a" stroke-width="2.5"/>
    <circle cx="-8" cy="-4" r="3" fill="#1a1a1a"/><circle cx="8" cy="-4" r="3" fill="#1a1a1a"/>
    <path d="M-3 5 L3 5 L0 9 Z" fill="#1a1a1a"/>
    <path d="M22 8 L52 26" stroke="#1a1a1a" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="-16" cy="9" rx="10" ry="6" fill="#ff8fb1"/>
    <path d="M-26 -10 q26 -24 52 0" stroke="#1a1a1a" stroke-width="2.5" fill="none"/>
    <circle cx="-27" cy="-8" r="6" fill="${ear}" stroke="#1a1a1a" stroke-width="2"/><circle cx="27" cy="-8" r="6" fill="${ear}" stroke="#1a1a1a" stroke-width="2"/>
  </g>`;
}

function eijin(art: CardArt): string {
  const n = art.members.length;
  const xs = spread(n, 100, 420);
  const s = birdScale(n);
  const birds = art.members.slice(0, 6).map((m, i) => flatBird(xs[i], 166 - (i % 2) * 6, s, teamColor(m.teamId))).join("");
  return `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b2fa8"/><stop offset="0.65" stop-color="#1f5fe0"/><stop offset="1" stop-color="#5aa9ff"/></linearGradient>
    <clipPath id="pic"><rect x="30" y="30" width="540" height="560"/></clipPath>
    ${HOLO_DEF}
  </defs>
  <rect width="600" height="840" fill="#fffdf6"/>
  <g clip-path="url(#pic)">
    <rect x="30" y="30" width="540" height="560" fill="url(#sky)"/>
    <g><ellipse cx="420" cy="120" rx="110" ry="28" fill="#dbe9ff"/><ellipse cx="400" cy="110" rx="90" ry="30" fill="#fff"/><ellipse cx="455" cy="100" rx="50" ry="34" fill="#fff"/><ellipse cx="120" cy="170" rx="80" ry="20" fill="#dbe9ff"/><ellipse cx="110" cy="160" rx="60" ry="24" fill="#fff"/></g>
    <g>
      <rect x="330" y="300" width="220" height="130" fill="#fff"/>
      <rect x="340" y="312" width="200" height="14" fill="#ff2e63"/>
      <text x="440" y="324" font-family="${JP}" font-size="11" font-weight="700" fill="#fff" text-anchor="middle" letter-spacing="3">SNOW STATION</text>
      <g fill="#1f5fe0"><rect x="350" y="345" width="34" height="48"/><rect x="400" y="345" width="34" height="48"/><rect x="450" y="345" width="34" height="48"/><rect x="500" y="345" width="34" height="48"/></g>
      <path d="M325 300 L440 240 L555 300 Z" fill="#ff2e63"/>
      <path d="M325 300 L440 240 L555 300" stroke="#fff" stroke-width="10" fill="none" stroke-linejoin="round"/>
      <rect x="296" y="296" width="34" height="134" fill="#17c964"/>
      <path d="M176 400 L282 400 L298 414 L282 428 L176 428 Z" fill="#ff2e63"/>
      <text x="232" y="419" font-family="${JP}" font-size="12" font-weight="700" fill="#fff" text-anchor="middle" letter-spacing="1">ROLL CALL 6:30</text>
    </g>
    <rect x="30" y="430" width="540" height="160" fill="#ffffff"/>
    <path d="M30 430 L570 430 L570 450 Q300 470 30 452 Z" fill="#bcd6ff"/>
    <path d="M30 520 L570 500 L570 590 L30 590 Z" fill="#5d6f99"/>
    <path d="M30 556 L570 538" stroke="#fff" stroke-width="4" stroke-dasharray="28 22"/>
    <path d="M418 520 L446 432 L478 432 L506 520 Z" fill="#2ad4ff"/><path d="M478 432 L506 520 L526 520 L492 432 Z" fill="#0b8fd6"/>
    <g transform="translate(40 470)">
      <ellipse cx="190" cy="118" rx="200" ry="12" fill="#2d3f72" opacity="0.5"/>
      <rect x="20" y="40" width="200" height="60" rx="4" fill="#e81e3c"/><path d="M220 100 L220 30 L290 30 L330 70 L330 100 Z" fill="#e81e3c"/>
      <path d="M232 38 L284 38 L316 70 L232 70 Z" fill="#9fe3ff"/><rect x="20" y="30" width="200" height="14" fill="#fff"/>
      <path d="M24 32 Q120 -34 216 32 Z" fill="#fff" stroke="#1a1a1a" stroke-width="2.5"/><path d="M120 -14 Q170 -10 206 30 L120 30 Z" fill="#bcd6ff"/>
      <rect x="20" y="86" width="310" height="10" fill="#b5122d"/>
      <circle cx="70" cy="104" r="20" fill="#1a1a1a"/><circle cx="70" cy="104" r="9" fill="#fff"/><circle cx="285" cy="104" r="20" fill="#1a1a1a"/><circle cx="285" cy="104" r="9" fill="#fff"/>
      <rect x="324" y="78" width="8" height="10" fill="#ffd400"/>
    </g>
    <g><rect x="500" y="130" width="16" height="310" fill="#fff"/><g fill="#1a1a1a"><rect x="500" y="170" width="9" height="6"/><rect x="507" y="230" width="9" height="6"/><rect x="500" y="300" width="9" height="6"/><rect x="507" y="370" width="9" height="6"/></g><path d="M508 130 L470 95 M508 130 L548 100 M508 135 L508 70 M508 150 L462 135 M508 150 L556 138" stroke="#1a1a1a" stroke-width="3" stroke-linecap="round"/></g>
    <path d="M30 200 Q300 170 570 215" stroke="#1a1a1a" stroke-width="4" fill="none"/>
    ${birds}
    <g fill="none" stroke-linecap="round" stroke-width="9">
      <path d="M20 120 Q160 60 330 110 T600 90" stroke="#ff2e63"/><path d="M-10 350 Q120 300 260 340 T560 320" stroke="#ffd400"/>
      <path d="M200 40 Q320 10 460 60 T620 50" stroke="#2ad4ff"/><path d="M40 480 Q200 440 360 470" stroke="#17c964" stroke-width="7"/>
    </g>
    <g><rect x="90" y="90" width="14" height="14" fill="#ffd400" transform="rotate(20 97 97)"/><circle cx="360" cy="180" r="7" fill="#ff2e63"/><rect x="470" y="200" width="12" height="12" fill="#2ad4ff" transform="rotate(-15 476 206)"/><circle cx="150" cy="300" r="6" fill="#17c964"/><rect x="300" y="60" width="10" height="24" fill="#fff" transform="rotate(30 305 72)"/><circle cx="540" cy="60" r="6" fill="#ffd400"/><rect x="60" y="400" width="12" height="12" fill="#ff2e63" transform="rotate(10 66 406)"/><circle cx="420" cy="470" r="5" fill="#2ad4ff"/></g>
  </g>
  ${art.scene ? sceneLayer(art.scene) : ""}
  ${holo()}
  <rect x="30" y="30" width="540" height="560" fill="none" stroke="#1a1a1a" stroke-width="3"/>
  ${stamp(art, "#e81e3c", "#fffdf6")}
  ${info(art, { pill: "#ffd400", pillText: "#1a1a1a", title: "#0b2fa8", subtitle: "#ff2e63", names: "#1a1a1a", meta: "#555" })}`;
}

const STYLES: Record<CardStyle, (art: CardArt) => string> = { kawaii, retrowave, kirie, pixel, eijin };

/** 表面 */
export function renderCardSvg(art: CardArt): string {
  const body = STYLES[art.style](art);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">${body}\n</svg>`;
}

export interface CardBack {
  /** 依頼者の一言（なければ定型） */
  thanks: string;
  subtasks: string[];
  /** 受け取る人にとって最初のカード（初出撃） */
  firstFlight?: boolean;
}

/** 裏面（LINE では2枚目）: 依頼者の一言、やったこと、排雪。初出撃ならリボン */
export function renderCardBackSvg(art: CardArt, back: CardBack): string {
  const lines = back.subtasks.slice(0, 6).map((t, i) => `<text x="80" y="${430 + i * 34}" font-family="${JP}" font-size="20" fill="#3b2a78">☑ ${escapeXml(t)}</text>`).join("");
  const ribbon = back.firstFlight
    ? `<g transform="translate(300 206)"><rect x="-120" y="-17" width="240" height="34" rx="17" fill="#ffd400"/><text x="0" y="6" font-family="${JP}" font-size="16" font-weight="700" fill="#3b2a78" text-anchor="middle" letter-spacing="2">初出撃 ・ FIRST FLIGHT</text></g>`
    : "";
  const thanks = wrap(back.thanks, 16)
    .slice(0, 4)
    .map((l, i) => `<text x="300" y="${250 + i * 38}" font-family="${JP}" font-size="24" font-weight="700" fill="#6b4fcf" text-anchor="middle">${escapeXml(l)}</text>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CARD_W} ${CARD_H}" width="${CARD_W}" height="${CARD_H}">
  <rect width="600" height="840" rx="28" fill="#fff6fb"/>
  <rect x="30" y="30" width="540" height="780" rx="26" fill="#fff" stroke="#cdbaff" stroke-width="2"/>
  <text x="300" y="110" font-family="${EN}" font-style="italic" font-size="34" fill="#ff4f8b" text-anchor="middle">Thank you!</text>
  <text x="300" y="150" font-family="${JP}" font-size="16" fill="#8a7bb5" text-anchor="middle" letter-spacing="2">${escapeXml(art.designName)} ｜ No.${String(art.serial).padStart(3, "0")}/${art.issuedCount}</text>
  <g fill="none" stroke="#ffb3d9" stroke-width="3" stroke-linecap="round"><path d="M80 190 q20 -14 40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0 t40 0"/></g>
  ${ribbon}
  ${thanks}
  <text x="80" y="395" font-family="${JP}" font-size="14" fill="#8a7bb5" letter-spacing="2">このときにやったこと</text>
  ${lines}
  ${art.scene ? `<text x="300" y="634" font-family="${JP}" font-size="13" fill="#8a7bb5" text-anchor="middle">この時だけの設計図 #${escapeXml(art.scene.code)} ・ ${escapeXml(art.scene.why)}</text>` : ""}
  <rect x="60" y="650" width="480" height="110" rx="20" fill="#f1ecff"/>
  <text x="300" y="692" font-family="${JP}" font-size="16" fill="#6b4fcf" text-anchor="middle">どけた雪 およそ</text>
  <text x="300" y="${art.snowKgBasis ? 728 : 736}" font-family="${JP}" font-size="34" font-weight="700" fill="#6b4fcf" text-anchor="middle">${art.snowKg}kg ・ ${escapeXml(art.snowKgComparison)}</text>
  ${art.snowKgBasis ? `<text x="300" y="752" font-family="${JP}" font-size="12" fill="#8a7bb5" text-anchor="middle">推定: ${escapeXml(art.snowKgBasis)}</text>` : ""}
  <text x="300" y="800" font-family="${JP}" font-size="12" fill="#8a7bb5" text-anchor="middle" letter-spacing="2">${escapeXml(dateLabel(art.date))} ・ ${escapeXml(art.townName)} ・ #シマエナGO</text>
</svg>`;
}

/**
 * 前の裏面から「設計図」と「推定の元」の行を読み戻す（ありがとう点呼で裏面を描き直しても消さないため。表は表に描いてある）。
 * 表に XML の記号は出ないので、エスケープを戻すだけでよい。
 */
export function backExtras(backSvg: string): { scene?: Pick<CardScene, "code" | "why">; basis?: string } {
  const un = (t: string) => t.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  const sc = /この時だけの設計図 #([0-9a-f]{4}) ・ ([^<]*)</.exec(backSvg);
  const basis = /推定: ([^<]*)</.exec(backSvg);
  return {
    ...(sc ? { scene: { code: sc[1], why: un(sc[2]) } } : {}),
    ...(basis ? { basis: un(basis[1]) } : {}),
  };
}

/** 日本語を n 文字ごとに折り返す（句読点で切れるなら優先） */
export function wrap(text: string, n: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const ch of text) {
    cur += ch;
    if (cur.length >= n || ch === "\n") {
      out.push(cur.trim());
      cur = "";
    } else if ((ch === "。" || ch === "！" || ch === "!") && cur.length >= n * 0.6) {
      out.push(cur.trim());
      cur = "";
    }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}
