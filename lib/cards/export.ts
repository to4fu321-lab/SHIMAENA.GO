// SNS 用の書き出し（spec 7）: 正方形（Instagram）と 4:5（X）。カードをパステルの台紙の真ん中に置く。
import { CARD_H, CARD_W } from "./svg";

export type ExportFormat = "square" | "portrait";

const SIZE: Record<ExportFormat, [number, number]> = { square: [1080, 1080], portrait: [1080, 1350] };

/** 600×840 のカード SVG を、台紙つきの SVG に包む（PNG 化は png.ts） */
export function composeForExport(cardSvg: string, format: ExportFormat): string {
  const [w, h] = SIZE[format];
  const pad = 60;
  const scale = Math.min((w - pad * 2) / CARD_W, (h - pad * 2) / CARD_H);
  const cw = CARD_W * scale;
  const ch = CARD_H * scale;
  const x = (w - cw) / 2;
  const y = (h - ch) / 2;
  // 中身だけ取り出す（<svg ...> と </svg> を外す）
  const inner = cardSvg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs><linearGradient id="mat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe3f1"/><stop offset="1" stop-color="#dff6f3"/></linearGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#mat)"/>
  <g transform="translate(${x} ${y}) scale(${scale})">
    <rect x="6" y="10" width="${CARD_W}" height="${CARD_H}" rx="28" fill="#000" opacity="0.12"/>
    ${inner}
  </g>
  <text x="${w / 2}" y="${h - 22}" font-family="Zen Maru Gothic, sans-serif" font-size="20" fill="#8a7bb5" text-anchor="middle" letter-spacing="4">#シマエナGO</text>
</svg>`;
}
