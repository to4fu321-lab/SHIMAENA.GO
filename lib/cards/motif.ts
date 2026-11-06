// カードの挿絵（spec v1.23）: 1枚ごとに、その日の話題とその時の事実から描く丸いステッカー。
// ・キーあり: Claude が 120×120 の中に図形（丸・楕円・四角・多角形・線・パス）を並べて描く。プログラムが点検してから SVG にする
//   （使える要素と属性だけ・数は範囲の中・色は #rrggbb・パスの命令は文字を限る・最大 48 個。スクリプトや外の画像は入りようがない）
// ・キーなし／描けなかった: プログラムが話題の種類（ゆず・ツリー・鬼 …）を描き、設計図の番号から毎回ちがう雪の結晶を散らす
import { z } from "zod";
import type { CardStyle } from "../types";
import type { MotifHint } from "../topic/calendar";

export const MOTIF_SIZE = 120;
export const MAX_SHAPES = 48;

export const ShapeSchema = z.object({
  kind: z.enum(["circle", "ellipse", "rect", "polygon", "path", "line"]),
  /** circle・ellipse の中心、rect の左上、line の始点 */
  x: z.number(),
  y: z.number(),
  /** circle の半径（r）、ellipse の横・縦の半径（w・h）、rect の幅・高さ（w・h）、line の終点（w=x2・h=y2） */
  r: z.number(),
  w: z.number(),
  h: z.number(),
  /** polygon の点（"x,y x,y …"）。ほかは空 */
  points: z.string(),
  /** path の d（M L H V C S Q T A Z と数だけ）。ほかは空 */
  d: z.string(),
  fill: z.string(),
  stroke: z.string(),
  strokeWidth: z.number(),
  opacity: z.number(),
});
export const MotifSchema = z.object({
  /** 丸の地の色 */
  bg: z.string(),
  shapes: z.array(ShapeSchema),
});
export type MotifRaw = z.infer<typeof MotifSchema>;

/** 点検済みの挿絵（カードに描ける形） */
export interface Motif {
  /** 話題の名前（ステッカーの下の帯） */
  topic: string;
  bg: string;
  /** 点検済みの SVG（120×120 の座標） */
  body: string;
  by: "claude" | "program";
}

const COLOR = /^#[0-9a-fA-F]{6}$/;
const color = (c: string, fallback: string) => (COLOR.test(c.trim()) ? c.trim().toLowerCase() : c.trim() === "none" ? "none" : fallback);
const num = (n: number, lo = -20, hi = MOTIF_SIZE + 20) => (Number.isFinite(n) ? Math.round(Math.min(hi, Math.max(lo, n)) * 10) / 10 : 0);
const POINTS = /^[0-9.,\s-]+$/;
const PATH = /^[MLHVCSQTAZmlhvcsqtaz0-9.,\s-]+$/;

/** Claude の図形を点検して SVG に（使えない図形は捨てる）。3つ未満しか残らなければ undefined */
export function sanitizeMotif(raw: MotifRaw, topic: string): Motif | undefined {
  const out: string[] = [];
  for (const s of raw.shapes.slice(0, MAX_SHAPES)) {
    const paint = `fill="${color(s.fill, "none")}" stroke="${color(s.stroke, "none")}" stroke-width="${num(s.strokeWidth, 0, 8)}" opacity="${num(s.opacity, 0, 1) || 1}"`;
    switch (s.kind) {
      case "circle":
        if (s.r > 0) out.push(`<circle cx="${num(s.x)}" cy="${num(s.y)}" r="${num(s.r, 0, 80)}" ${paint}/>`);
        break;
      case "ellipse":
        if (s.w > 0 && s.h > 0) out.push(`<ellipse cx="${num(s.x)}" cy="${num(s.y)}" rx="${num(s.w, 0, 80)}" ry="${num(s.h, 0, 80)}" ${paint}/>`);
        break;
      case "rect":
        if (s.w > 0 && s.h > 0) out.push(`<rect x="${num(s.x)}" y="${num(s.y)}" width="${num(s.w, 0, 160)}" height="${num(s.h, 0, 160)}" rx="${num(s.r, 0, 40)}" ${paint}/>`);
        break;
      case "line":
        out.push(`<line x1="${num(s.x)}" y1="${num(s.y)}" x2="${num(s.w)}" y2="${num(s.h)}" stroke-linecap="round" ${paint}/>`);
        break;
      case "polygon": {
        const p = s.points.trim();
        if (p && p.length <= 400 && POINTS.test(p)) {
          const pts = p.split(/\s+/).map((xy) => xy.split(",").map((v) => num(Number(v))).join(",")).join(" ");
          out.push(`<polygon points="${pts}" ${paint}/>`);
        }
        break;
      }
      case "path": {
        const d = s.d.trim();
        if (d && d.length <= 800 && PATH.test(d)) out.push(`<path d="${d.replace(/\s+/g, " ")}" stroke-linecap="round" stroke-linejoin="round" ${paint}/>`);
        break;
      }
    }
  }
  if (out.length < 3) return undefined;
  return { topic, bg: color(raw.bg, "#eaf3ff"), body: out.join(""), by: "claude" };
}

// ---- プログラムの挿絵（キーなし・描けなかったとき） ----

/** 番号から決まる、毎回同じ乱数 */
function rng(seed: string) {
  let a = 0;
  for (const ch of seed) a = (a * 31 + ch.charCodeAt(0)) & 0x7fffffff;
  a = a || 1;
  return () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    return a / 0x7fffffff;
  };
}

const BG = ["#dff1ff", "#fff1d6", "#ffe3ef", "#e8e2ff", "#dcf7ee", "#fff8c4"];

/** 毎回ちがう雪の結晶（6回対称。枝の長さ・角度・数を乱数で） */
export function crystal(seed: string, cx: number, cy: number, size: number, stroke = "#5a8fd8"): string {
  const r = rng(seed);
  const branches = Array.from({ length: 2 + Math.floor(r() * 3) }, () => ({ at: 0.3 + r() * 0.55, len: 0.15 + r() * 0.3, ang: 35 + r() * 30 }));
  const tip = r() < 0.5;
  const arm = (() => {
    let d = `M0 0 L0 ${-size}`;
    for (const b of branches) {
      const y = -size * b.at;
      const l = size * b.len;
      const dx = Math.sin((b.ang * Math.PI) / 180) * l;
      const dy = -Math.cos((b.ang * Math.PI) / 180) * l;
      d += ` M0 ${y.toFixed(1)} l${dx.toFixed(1)} ${dy.toFixed(1)} M0 ${y.toFixed(1)} l${(-dx).toFixed(1)} ${dy.toFixed(1)}`;
    }
    return d;
  })();
  const arms = [0, 60, 120, 180, 240, 300].map((a) => `<path d="${arm}" transform="rotate(${a})"/>`).join("");
  return `<g transform="translate(${cx} ${cy})" fill="none" stroke="${stroke}" stroke-width="${Math.max(1.2, size / 14).toFixed(1)}" stroke-linecap="round">${arms}${tip ? `<circle r="${(size / 7).toFixed(1)}" fill="#fff"/>` : ""}</g>`;
}

const DRAW: Record<MotifHint, string> = {
  crystal: "",
  yuzu: `<circle cx="60" cy="66" r="26" fill="#ffc83d" stroke="#e09a1a" stroke-width="2"/><circle cx="52" cy="58" r="3" fill="#fff3b0"/><path d="M60 40 q8 -12 20 -8 q-6 10 -20 8 Z" fill="#5fae5a"/><path d="M28 98 q32 12 64 0" stroke="#7fb8e8" stroke-width="4" fill="none"/>`,
  tree: `<polygon points="60,22 86,62 72,62 92,92 28,92 48,62 34,62" fill="#3c9a6a"/><rect x="54" y="92" width="12" height="12" fill="#8a6a4a"/><polygon points="60,14 63,22 71,22 65,27 67,35 60,30 53,35 55,27 49,22 57,22" fill="#ffd400"/><circle cx="50" cy="70" r="3" fill="#ff7ab8"/><circle cx="70" cy="80" r="3" fill="#2f6fe4"/><circle cx="62" cy="52" r="3" fill="#ff8a3d"/>`,
  bell: `<path d="M60 28 c-20 0 -24 22 -24 38 l-8 14 h64 l-8 -14 c0 -16 -4 -38 -24 -38 Z" fill="#ffd36e" stroke="#c99a2e" stroke-width="2"/><circle cx="60" cy="86" r="6" fill="#c99a2e"/><path d="M48 24 q12 -10 24 0" stroke="#e64b5d" stroke-width="5" fill="none"/>`,
  kadomatsu: `<rect x="36" y="74" width="48" height="28" rx="4" fill="#c99a6a"/><path d="M46 74 L46 30 M60 74 L60 20 M74 74 L74 36" stroke="#4fae6a" stroke-width="9" stroke-linecap="square"/><path d="M38 70 q22 -12 44 0" stroke="#3c8a5a" stroke-width="4" fill="none"/>`,
  mochi: `<ellipse cx="60" cy="84" rx="32" ry="14" fill="#fff" stroke="#c9c9d9" stroke-width="2"/><ellipse cx="60" cy="66" rx="24" ry="12" fill="#fff" stroke="#c9c9d9" stroke-width="2"/><circle cx="60" cy="50" r="10" fill="#ffb02e"/><path d="M60 40 l4 -8" stroke="#5fae5a" stroke-width="3"/>`,
  oni: `<circle cx="60" cy="64" r="28" fill="#ff8aa8"/><path d="M42 42 l-6 -14 l12 8 Z M78 42 l6 -14 l-12 8 Z" fill="#ffd400"/><circle cx="50" cy="60" r="4" fill="#3b2a78"/><circle cx="70" cy="60" r="4" fill="#3b2a78"/><path d="M50 76 q10 8 20 0" stroke="#3b2a78" stroke-width="3" fill="none"/><g fill="#c99a6a"><circle cx="24" cy="100" r="3"/><circle cx="34" cy="104" r="3"/><circle cx="92" cy="102" r="3"/></g>`,
  heart: `<path d="M60 92 C24 66 32 34 52 38 C58 39 60 44 60 48 C60 44 62 39 68 38 C88 34 96 66 60 92 Z" fill="#ff6f9c"/><path d="M48 50 q4 -6 10 -4" stroke="#fff" stroke-width="3" fill="none"/>`,
  hina: `<circle cx="44" cy="52" r="10" fill="#ffe8d6"/><path d="M28 98 L44 62 L60 98 Z" fill="#2f6fe4"/><circle cx="76" cy="52" r="10" fill="#ffe8d6"/><path d="M60 98 L76 62 L92 98 Z" fill="#ff6f9c"/><rect x="38" y="40" width="12" height="6" fill="#3b2a78"/>`,
  lantern: `<rect x="44" y="34" width="32" height="48" rx="12" fill="#ffd36e" stroke="#c97a2e" stroke-width="2"/><circle cx="60" cy="58" r="30" fill="#ffd36e" opacity="0.3"/><path d="M50 28 h20 M50 88 h20" stroke="#3b2a78" stroke-width="4"/>`,
  leaf: `<path d="M30 90 C30 50 60 30 92 28 C90 60 70 90 30 90 Z" fill="#7fcf8a"/><path d="M30 90 L80 40" stroke="#3c8a5a" stroke-width="3"/>`,
  moon: `<circle cx="64" cy="54" r="26" fill="#fff6c8"/><circle cx="76" cy="46" r="24" fill="#2b3a6b"/><g fill="#fff"><circle cx="30" cy="34" r="2"/><circle cx="96" cy="80" r="2"/><circle cx="40" cy="86" r="1.5"/></g>`,
};

/** プログラムの挿絵: 話題の絵（なければ大きな結晶）＋ 毎回ちがう小さな結晶 */
export function programMotif(seed: string, topic: string, hint: MotifHint): Motif {
  const r = rng(seed);
  const bg = hint === "moon" ? "#2b3a6b" : BG[Math.floor(r() * BG.length)];
  const main = hint === "crystal" ? crystal(seed, 60, 60, 40) : DRAW[hint];
  const small = Array.from({ length: 3 }, (_, i) => crystal(`${seed}|${i}`, 14 + r() * 92, 12 + r() * 24 + (i === 2 ? 70 : 0), 6 + r() * 6, hint === "moon" ? "#ffffff" : "#7aa7e8")).join("");
  return { topic, bg, body: `${main}${small}`, by: "program" };
}

// ---- カードに貼る ----

/** タッチごとの貼る場所（絵の枠の中で、ほかの絵とぶつかりにくいところ） */
const SPOT: Record<CardStyle, { x: number; y: number; rot: number }> = {
  kawaii: { x: 450, y: 395, rot: 6 },
  retrowave: { x: 150, y: 420, rot: -6 },
  kirie: { x: 160, y: 330, rot: -5 },
  pixel: { x: 300, y: 150, rot: 0 },
  eijin: { x: 150, y: 330, rot: -6 },
};
const R = 70;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function stickerSvg(style: CardStyle, m: Motif, id: string): string {
  const s = SPOT[style];
  const k = (R * 2) / MOTIF_SIZE;
  const clip = `mo${id.replace(/[^0-9a-zA-Z]/g, "")}`;
  const label = m.topic.slice(0, 10);
  const w = Math.max(70, label.length * 15 + 26);
  return `<g data-motif="${m.by}" transform="translate(${s.x} ${s.y}) rotate(${s.rot})">
    <defs><clipPath id="${clip}"><circle r="${R}"/></clipPath></defs>
    <circle r="${R + 7}" fill="#ffffff" stroke="#3b2a78" stroke-opacity="0.18" stroke-width="2"/>
    <g clip-path="url(#${clip})"><rect x="${-R}" y="${-R}" width="${R * 2}" height="${R * 2}" fill="${m.bg}"/><g transform="translate(${-R} ${-R}) scale(${k.toFixed(4)})">${m.body}</g></g>
    <rect x="${-w / 2}" y="${R - 6}" width="${w}" height="24" rx="12" fill="#3b2a78"/>
    <text x="0" y="${R + 11}" font-family="Zen Maru Gothic, Noto Sans JP, sans-serif" font-size="14" font-weight="700" fill="#ffffff" text-anchor="middle">${esc(label)}</text>
  </g>`;
}
