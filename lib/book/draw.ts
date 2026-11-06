// 絵本のさし絵をプログラムで描く（spec v1.27。Claude のキーがないとき・描けなかったとき）。600×450。
// 町（家並み・雪・空）は共通、ページの役目ごとに主役の場面を変える。週ごとの番号で雪の降り方・家の並びが変わる。
import { kawaiiBird } from "../cards/svg";
import { crystal } from "../cards/motif";
import type { PageKind, StyleBible } from "./story";
import type { BookFacts } from "./facts";

export const PAGE_W = 600;
export const PAGE_H = 450;

function rng(seed: string) {
  let a = 1;
  for (const ch of seed) a = (a * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    a = (a * 1103515245 + 12345) >>> 0;
    return (a >>> 8) / 0x1000000;
  };
}

const f1 = (n: number) => n.toFixed(1);

function shovel(x: number, y: number, s = 1, rot = 20): string {
  return `<g transform="translate(${f1(x)} ${f1(y)}) rotate(${rot}) scale(${s})"><path d="M0 -34 L0 8" stroke="#8a6a4a" stroke-width="5" stroke-linecap="round"/><path d="M-11 6 h22 l-3 20 h-16 Z" fill="#ff8a3d" stroke="#3b2a78" stroke-width="2"/></g>`;
}

function house(x: number, w: number, h: number, wall: string, roof: string, lit: boolean): string {
  const top = 330 - h;
  return `<g>
    <rect x="${f1(x)}" y="${f1(top)}" width="${f1(w)}" height="${f1(h)}" fill="${wall}"/>
    <polygon points="${f1(x - 8)},${f1(top)} ${f1(x + w / 2)},${f1(top - w * 0.42)} ${f1(x + w + 8)},${f1(top)}" fill="${roof}"/>
    <path d="M${f1(x - 10)} ${f1(top + 2)} L${f1(x + w / 2)} ${f1(top - w * 0.42 - 4)} L${f1(x + w + 10)} ${f1(top + 2)} q-4 8 -12 4 q-${f1(w / 3)} 6 -${f1(w / 2)} -2 q-${f1(w / 4)} 10 -${f1(w / 2 - 6)} 2 Z" fill="#ffffff"/>
    <rect x="${f1(x + w * 0.2)}" y="${f1(top + h * 0.3)}" width="${f1(w * 0.22)}" height="${f1(h * 0.24)}" rx="3" fill="${lit ? "#ffd36e" : "#cfe0f5"}"/>
    <rect x="${f1(x + w * 0.58)}" y="${f1(top + h * 0.3)}" width="${f1(w * 0.22)}" height="${f1(h * 0.24)}" rx="3" fill="${lit ? "#ffe7a0" : "#cfe0f5"}"/>
    ${lit ? `<circle cx="${f1(x + w * 0.31)}" cy="${f1(top + h * 0.42)}" r="${f1(w * 0.3)}" fill="#ffd36e" opacity="0.18"/>` : ""}
    <rect x="${f1(x + w * 0.4)}" y="${f1(top + h * 0.62)}" width="${f1(w * 0.2)}" height="${f1(h * 0.38)}" rx="2" fill="#8a6a4a"/>
  </g>`;
}

const SKY: Record<PageKind, [string, string]> = {
  cover: ["#ffd9c7", "#cfe6ff"],
  start: ["#b9c7e6", "#eef3fb"],
  snow: ["#c9b8f0", "#fde9f1"],
  teams: ["#8fc4ff", "#e9f6ff"],
  numbers: ["#a8d8ff", "#f4fbff"],
  thanks: ["#ffc59e", "#fff3dc"],
  next: ["#ff9fb7", "#ffe8a8"],
};

/** 1ページ分のさし絵（SVG の中身） */
export function programPage(kind: PageKind, f: BookFacts, style: StyleBible, seed: string): string {
  const r = rng(`${seed}|${kind}`);
  const [skyTop, skyBottom] = SKY[kind];
  const accent = style.palette[3] ?? "#ffb3c7";
  const colors = f.teams.map((t) => t.color);
  const p = `b${seed.replace(/[^A-Za-z0-9]/g, "").slice(-6)}${kind}`;
  const defs = `<defs>
    <linearGradient id="${p}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${skyTop}"/><stop offset="1" stop-color="${skyBottom}"/></linearGradient>
    <linearGradient id="${p}snow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#dbe7f7"/></linearGradient>
  </defs>`;
  const sky = `<rect width="${PAGE_W}" height="${PAGE_H}" fill="url(#${p}sky)"/>`;
  const orb =
    kind === "start"
      ? ""
      : kind === "next" || kind === "cover"
        ? `<circle cx="${kind === "next" ? 300 : 470}" cy="${kind === "next" ? 250 : 96}" r="${kind === "next" ? 70 : 38}" fill="#fff4c2" opacity="0.95"/><circle cx="${kind === "next" ? 300 : 470}" cy="${kind === "next" ? 250 : 96}" r="${kind === "next" ? 110 : 64}" fill="#fff4c2" opacity="0.25"/>`
        : `<circle cx="96" cy="82" r="30" fill="#fff6d0" opacity="0.9"/>`;
  const hills = `<path d="M0 250 Q120 190 240 236 T480 222 T600 240 V330 H0 Z" fill="${style.palette[1] ?? "#9fc3f0"}" opacity="0.55"/><path d="M0 280 Q160 238 320 270 T600 262 V330 H0 Z" fill="#ffffff" opacity="0.85"/>`;
  // 家並み（週ごとに並びが変わる）
  const walls = ["#f6e7d8", "#e8eef8", "#f9e1e8", "#efe6fb"];
  const roofs = ["#6b5bd6", "#3c6fd8", "#d9637a", "#4e8a7a", "#8a5a44"];
  let houses = "";
  for (let x = -20; x < PAGE_W; ) {
    const w = 70 + r() * 40;
    const h = 46 + r() * 30;
    houses += house(x, w, h, walls[Math.floor(r() * walls.length)], roofs[Math.floor(r() * roofs.length)], kind === "thanks" || kind === "start" || r() < 0.4);
    x += w + 18 + r() * 24;
  }
  const wire = `<path d="M0 150 Q300 190 600 140" stroke="#5b6b82" stroke-width="2" fill="none" opacity="0.6"/>`;
  const ground = `<path d="M0 322 Q150 306 300 318 T600 314 V450 H0 Z" fill="url(#${p}snow)"/>`;
  const heavy = kind === "snow" || kind === "start";
  const flakes = Array.from({ length: heavy ? 60 : 26 }, () => `<circle cx="${f1(r() * PAGE_W)}" cy="${f1(r() * 320)}" r="${f1(1.5 + r() * (heavy ? 3.5 : 2.2))}" fill="#ffffff" opacity="${(0.6 + r() * 0.4).toFixed(2)}"/>`).join("");
  const crystals = Array.from({ length: 4 }, (_, i) => crystal(`${seed}${kind}${i}`, 40 + r() * 520, 30 + r() * 150, 8 + r() * 8, "#ffffff")).join("");

  const bird = (x: number, y: number, s: number, ear: string, withShovel = true) => `${kawaiiBird(x, y, s, ear)}${withShovel ? shovel(x + 30 * s, y + 6 * s, s * 0.9) : ""}`;
  let main = "";
  switch (kind) {
    case "cover":
      main = `<path d="M40 450 Q300 290 560 450 Z" fill="#ffffff"/>${bird(190, 352, 0.9, colors[0])}${bird(300, 326, 1.05, colors[1])}${bird(410, 352, 0.9, colors[2])}`;
      break;
    case "start":
      main = [140, 230, 320, 410].map((x, i) => kawaiiBird(x, 150 + Math.sin(x) * 6 - 22, 0.36, colors[i % 3])).join("") + `<path d="M80 420 q60 -20 120 -4" stroke="#c9d8ee" stroke-width="10" fill="none" stroke-linecap="round"/>`;
      break;
    case "snow":
      main = `<path d="M0 380 Q90 330 170 372 Q260 320 360 368 Q470 326 600 372 V450 H0 Z" fill="#ffffff" opacity="0.95"/>` + [110, 230, 350, 470].map((x, i) => bird(x, 378 - (i % 2) * 12, 0.72, colors[i % 3])).join("");
      break;
    case "teams":
      main = `<path d="M250 450 L300 330 L330 330 L420 450 Z" fill="#c9d8ee"/><path d="M262 450 L304 334 L326 334 L404 450 Z" fill="#e8f0fb"/>` + colors.map((c, i) => bird(180 + i * 120, 392 - i * 24, 0.78 - i * 0.08, c)).join("");
      break;
    case "numbers": {
      const mound = Array.from({ length: 6 }, (_, i) => `<ellipse cx="${300 + (i % 2 ? -1 : 1) * i * 6}" cy="${430 - i * 26}" rx="${170 - i * 24}" ry="${34 - i * 2}" fill="${i % 2 ? "#f4f8ff" : "#ffffff"}" stroke="#dbe7f7" stroke-width="2"/>`).join("");
      main = `${mound}${kawaiiBird(300, 262, 0.5, colors[0])}<path d="M332 250 L332 196" stroke="#8a6a4a" stroke-width="4"/><path d="M332 196 l34 10 l-34 10 Z" fill="${accent}"/>${bird(140, 396, 0.66, colors[1])}${bird(460, 396, 0.66, colors[2])}`;
      break;
    }
    case "thanks": {
      const hearts = Array.from({ length: 6 }, () => {
        const x = 200 + r() * 200;
        const y = 120 + r() * 120;
        const s = 0.6 + r() * 0.6;
        return `<path transform="translate(${f1(x)} ${f1(y)}) scale(${f1(s)})" d="M0 12 C-18 -2 -14 -16 -4 -14 C-1 -13 0 -10 0 -8 C0 -10 1 -13 4 -14 C14 -16 18 -2 0 12 Z" fill="${accent}" opacity="0.9"/>`;
      }).join("");
      main = `<rect x="250" y="250" width="100" height="120" rx="6" fill="#ffd36e" opacity="0.9"/><rect x="250" y="250" width="100" height="120" rx="6" fill="none" stroke="#8a6a4a" stroke-width="6"/><circle cx="300" cy="300" r="120" fill="#ffd36e" opacity="0.18"/>${hearts}${bird(160, 392, 0.7, colors[0])}${bird(440, 392, 0.7, colors[1])}<g transform="translate(300 410)"><path d="M-14 -6 h28 v16 a14 14 0 0 1 -28 0 Z" fill="#fff" stroke="#3b2a78" stroke-width="2"/><path d="M-6 -12 q4 -8 0 -16 M4 -12 q4 -8 0 -16" stroke="#ffffff" stroke-width="3" fill="none" stroke-linecap="round"/></g>`;
      break;
    }
    case "next":
      main =
        colors.map((c, i) => `<g transform="translate(${170 + i * 130} ${150 - (i % 2) * 30}) rotate(${-10 + i * 10})">${kawaiiBird(0, 0, 0.45, colors[(i + 1) % 3])}<path d="M-30 4 q-26 -24 -50 -6 M30 4 q26 -24 50 -6" stroke="#ffffff" stroke-width="6" fill="none" stroke-linecap="round"/></g>`).join("") +
        Array.from({ length: 8 }, (_, i) => `<ellipse cx="${90 + i * 60}" cy="${400 - (i % 2) * 14}" rx="7" ry="10" fill="#c9d8ee"/>`).join("");
      break;
  }
  return `${defs}${sky}${orb}${hills}${kind === "start" ? wire : ""}${houses}${ground}${crystals}${flakes}${main}`;
}
