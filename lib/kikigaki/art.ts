// 雪の聞き書きの絵（spec v1.26）。大きさはカードの絵と同じ 540×560。
// ・キーあり: Claude がお話の場面を、絵本の1ページとしてゼロから SVG で描く → 描いた絵を画像で見せて直してもらう（カードの絵と同じしくみ）
// ・キーなし／描けなかった: プログラムが、答えのことば（かまくら・そり・雪だるま・屋根 …）から思い出の場面を組み立てる
import { z } from "zod";
import { askJsonLong, hasClaudeKey } from "../claude/client";
import { wrapPicture } from "../claude/art";
import { cleanSvg } from "../cards/svg-clean";
import { svgToPng } from "../cards/png";
import { kawaiiBird } from "../cards/svg";
import type { Motif } from "./core";

export const W = 540;
export const H = 560;

const DrawSchema = z.object({ svg: z.string(), why: z.string() });

const RULES =
  "採点表 kikigaki.picture の規則に従って描いてください。" +
  `キャンバスは幅${W}×高さ${H}（座標 0〜${W} × 0〜${H}）。<svg> の中身だけを svg に入れます。` +
  "使える要素は g・path・circle・ellipse・rect・polygon・polyline・line・defs・use・linearGradient・radialGradient・stop・clipPath・mask・filter と fe で始まるフィルタだけ。" +
  "text・image・style 属性・CSS は使えません（使うと消えます）。";

/** Claude に、お話の場面を絵本の1ページとして描いてもらう（見直し1回）。描けなければ undefined */
export async function drawMemory(input: { title: string; story: string; scene: string; seed: string }): Promise<string | undefined> {
  if (!hasClaudeKey()) return undefined;
  const started = Date.now();
  const modelId = process.env.CARD_ART_MODEL?.trim() || undefined;
  const prefix = `k${input.seed.replace(/[^A-Za-z0-9]/g, "").slice(-8)}`;
  const facts = { title: input.title, story: input.story, scene: input.scene };
  const first = await askJsonLong({
    task:
      "お年寄りが話してくれた「雪の思い出」のお話に添える、絵本の1ページを、ゼロから1枚描いてください。" +
      "scene（場面）を主役に、むかしの冬のなつかしさが伝わる絵にします。やわらかい光、雪の白に青みの影、あたたかい差し色（窓の灯り・マフラー）。" +
      "遠景・中景・近景の3層以上。人は小さな後ろ姿やシルエットで（顔は描かない）。語り手として、白くて丸い小鳥シマエナガを小さく1羽どこかに。図形は 150〜500 個、合わせて 60KB まで。" +
      "why は、なぜこの絵か（40字まで、名前なし）。" +
      RULES,
    input: facts,
    schema: DrawSchema,
    effort: "high",
    modelId,
  });
  const draft = cleanSvg(first.svg, prefix);
  if (!draft) return undefined;
  if (Date.now() - started > 150_000) return draft.svg;
  try {
    const png = await svgToPng(wrapPicture(draft.svg), { width: W });
    const second = await askJsonLong({
      task:
        "画像は、あなたがいま描いた絵を実際に表示したものです。お話の絵本の1ページとして見直し、もっと良い最終版を描き直してください。" +
        "確かめること: 場面がお話と合っているか／はみ出し・切れ・不自然な重なり／何もない空白／なつかしさとあたたかさ／色の調和と奥行き。良いところは残し、svg 全体を返します。" +
        RULES,
      input: { ...facts, draftSvg: draft.svg.slice(0, 80_000) },
      images: [{ mediaType: "image/png", base64: Buffer.from(png).toString("base64") }],
      schema: DrawSchema,
      effort: "high",
      modelId,
    });
    return cleanSvg(second.svg, prefix)?.svg ?? draft.svg;
  } catch (e) {
    console.error("[kikigaki] 絵の見直しに失敗（1回目の絵を使います）:", e instanceof Error ? e.message : e);
    return draft.svg;
  }
}

// ---- プログラムの絵 ----

function rng(seed: string) {
  let a = 11;
  for (const ch of seed) a = (a * 131 + ch.charCodeAt(0)) >>> 0;
  return () => {
    a = (a * 1103515245 + 12345) >>> 0;
    return (a >>> 8) / 0x1000000;
  };
}

const SKIES = [
  { top: "#2b3a6b", mid: "#6a5d9a", low: "#f2b8a0", stars: true, glow: "#ffd9a8" }, // 夜明け前
  { top: "#9cc8ef", mid: "#cfe6f7", low: "#fff4e4", stars: false, glow: "#fff6d8" }, // 晴れた朝
  { top: "#1d2850", mid: "#34477e", low: "#7f8fbf", stars: true, glow: "#ffe2a0" }, // 雪の夜
  { top: "#c9b8de", mid: "#e9d8ea", low: "#fff1e6", stars: false, glow: "#ffe9c8" }, // 雪ぐもりの夕方
];

const house = (x: number, y: number, s: number, lit: string) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-46" y="-40" width="92" height="64" fill="#8a6a58"/>
    <polygon points="-62,-36 0,-86 62,-36" fill="#5b4a6e"/>
    <path d="M-66 -34 Q-40 -60 0 -92 Q40 -60 66 -34 Q40 -44 0 -40 Q-40 -44 -66 -34 Z" fill="#ffffff"/>
    <g fill="#ffffff">${[-44, -30, -16, 0, 16, 30, 44].map((ix, i) => `<path d="M${ix} -38 l3 ${10 + (i % 3) * 5} l3 -${10 + (i % 3) * 5} Z" fill="#dfefff"/>`).join("")}</g>
    <rect x="-30" y="-24" width="22" height="20" rx="2" fill="${lit}"/>
    <rect x="8" y="-24" width="22" height="20" rx="2" fill="${lit}"/>
    <circle cx="-19" cy="-14" r="22" fill="${lit}" opacity="0.18"/>
    <rect x="-10" y="0" width="20" height="24" fill="#4a3a40"/>
    <rect x="30" y="-104" width="12" height="26" fill="#6b5a60"/><rect x="28" y="-108" width="16" height="7" rx="3" fill="#ffffff"/>
  </g>`;

const MOTIF: Record<Motif, (r: () => number) => string> = {
  kamakura: () => `
    <g transform="translate(270 400)">
      <ellipse cx="0" cy="58" rx="150" ry="18" fill="#c9dcf0" opacity="0.7"/>
      <path d="M-130 60 Q-130 -90 0 -96 Q130 -90 130 60 Z" fill="#f7fbff" stroke="#c9dcf0" stroke-width="3"/>
      <path d="M-110 40 Q-100 -60 -20 -84" stroke="#ffffff" stroke-width="8" fill="none" opacity="0.8"/>
      <path d="M-48 60 Q-48 -8 0 -12 Q48 -8 48 60 Z" fill="#3a2a3e"/>
      <path d="M-40 60 Q-40 0 0 -4 Q40 0 40 60 Z" fill="#ff9a4a" opacity="0.55"/>
      <circle cx="0" cy="30" r="40" fill="#ffc46b" opacity="0.35"/>
      <rect x="-4" y="30" width="8" height="18" rx="2" fill="#fff2d0"/><path d="M0 22 q5 6 0 10 q-5 -4 0 -10 Z" fill="#ffb02e"/>
    </g>`,
  sled: (r) => `
    <path d="M0 330 Q200 360 540 520 L540 560 L0 560 Z" fill="#f4f9ff"/>
    <path d="M60 352 Q260 392 500 520" stroke="#c9dcf0" stroke-width="4" fill="none" stroke-dasharray="10 8"/>
    <g transform="translate(${290 + r() * 30} 440) rotate(22) scale(1.6)">
      <ellipse cx="0" cy="16" rx="66" ry="7" fill="#9fb3cc" opacity="0.45"/>
      <path d="M-22 -14 q0 -26 14 -30 q14 4 12 30 Z" fill="#3b4a6e"/><circle cx="-8" cy="-50" r="10" fill="#3b4a6e"/><path d="M-18 -50 q10 -12 20 0" fill="#c2453a"/><path d="M-4 -32 q22 2 30 10" stroke="#c2453a" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M14 -14 q0 -18 10 -22 q10 3 9 22 Z" fill="#5a4a6e"/><circle cx="24" cy="-42" r="8" fill="#5a4a6e"/><path d="M16 -42 q8 -10 16 0" fill="#ffd27a"/>
      <rect x="-56" y="-14" width="112" height="16" rx="6" fill="#c2453a"/>
      <path d="M-62 8 h120 q14 0 18 -14" stroke="#4a3a40" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M-30 2 v8 M30 2 v8" stroke="#4a3a40" stroke-width="4"/>
    </g>`,
  snowman: () => `
    <g transform="translate(270 420)">
      <ellipse cx="0" cy="70" rx="90" ry="14" fill="#c9dcf0" opacity="0.7"/>
      <circle cx="0" cy="30" r="62" fill="#ffffff" stroke="#c9dcf0" stroke-width="3"/>
      <circle cx="0" cy="-58" r="42" fill="#ffffff" stroke="#c9dcf0" stroke-width="3"/>
      <circle cx="-13" cy="-64" r="5" fill="#3b2a3e"/><circle cx="13" cy="-64" r="5" fill="#3b2a3e"/>
      <path d="M0 -54 l26 6 l-26 6 Z" fill="#ff8a3d"/>
      <path d="M-40 -24 q40 16 80 0 l0 14 q-40 16 -80 0 Z" fill="#c2453a"/><path d="M24 -14 l8 40 l-14 0 Z" fill="#c2453a"/>
      <path d="M-58 10 l-50 -40 M58 10 l50 -36" stroke="#6b4a3a" stroke-width="6" stroke-linecap="round"/>
      <rect x="-30" y="-120" width="60" height="30" rx="4" fill="#4a3a40"/><rect x="-42" y="-94" width="84" height="8" rx="4" fill="#4a3a40"/>
    </g>`,
  roof: () => `${house(270, 420, 2.1, "#ffd27a")}
    <g fill="#e6f3ff">${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${150 + i * 48} 352 l6 ${26 + (i % 2) * 18} l6 -${26 + (i % 2) * 18} Z"/>`).join("")}</g>`,
  snowball: (r) =>
    `<g fill="#ffffff" stroke="#c9dcf0" stroke-width="2">${Array.from({ length: 7 }, () => `<circle cx="${(80 + r() * 380).toFixed(0)}" cy="${(220 + r() * 160).toFixed(0)}" r="${(8 + r() * 8).toFixed(0)}"/>`).join("")}</g>` +
    `<g stroke="#ffffff" stroke-width="3" fill="none" opacity="0.7" stroke-dasharray="6 8"><path d="M90 420 Q200 260 330 300"/><path d="M450 430 Q360 280 210 330"/></g>`,
  shovel: () => `
    <path d="M220 560 L250 410 L290 410 L320 560 Z" fill="#dfe9f3"/>
    <path d="M150 560 Q170 470 240 420 L250 560 Z M390 560 Q370 470 300 420 L290 560 Z" fill="#ffffff"/>
    <g transform="translate(372 420) rotate(18)"><rect x="-4" y="-90" width="8" height="90" rx="3" fill="#8a6a4a"/><path d="M-26 0 h52 l-6 44 h-40 Z" fill="#e2563a"/></g>`,
  town: (r) =>
    [0, 1, 2, 3].map((i) => house(90 + i * 120 + r() * 10, 400 + (i % 2) * 16, 0.9, "#ffd27a")).join(""),
};

/** 雪をかぶったエゾマツ（手前の額縁） */
const pine = (x: number, y: number, s: number, dark: string) => `
  <g transform="translate(${x} ${y}) scale(${s})">
    <rect x="-6" y="0" width="12" height="26" fill="#5a4038"/>
    <polygon points="0,-120 46,-40 -46,-40" fill="${dark}"/><polygon points="0,-90 58,0 -58,0" fill="${dark}"/>
    <path d="M0 -120 L18 -90 Q8 -84 0 -92 Q-8 -84 -18 -90 Z M0 -88 L30 -48 Q14 -40 0 -52 Q-14 -40 -30 -48 Z M-58 0 Q-30 -14 0 -6 Q30 -14 58 0 Q30 -4 0 2 Q-30 -4 -58 0 Z" fill="#ffffff"/>
  </g>`;

/** キーなしの絵: 空と遠い山と町、思い出のもの、降る雪、語り手のシマエナガ、なつかしい色の膜 */
export function programMemory(seed: string, motifs: Motif[]): string {
  const r = rng(seed);
  const sky = SKIES[Math.floor(r() * SKIES.length)];
  const main = motifs[0] ?? "town";
  const stars = sky.stars ? Array.from({ length: 24 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * 200).toFixed(0)}" r="${(0.8 + r() * 1.4).toFixed(1)}" fill="#ffffff" opacity="${(0.5 + r() * 0.5).toFixed(2)}"/>`).join("") : "";
  const flakes = Array.from({ length: 70 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H).toFixed(0)}" r="${(1.2 + r() * 3).toFixed(1)}" fill="#ffffff" opacity="${(0.55 + r() * 0.45).toFixed(2)}"/>`).join("");
  const far = main === "roof" || main === "town" ? "" : `${house(110, 330, 0.7, "#ffd27a")}${house(440, 322, 0.6, "#ffe6a8")}`;
  return `
  <defs>
    <linearGradient id="ksky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky.top}"/><stop offset="0.55" stop-color="${sky.mid}"/><stop offset="1" stop-color="${sky.low}"/></linearGradient>
    <linearGradient id="kground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d6e6f5"/></linearGradient>
    <radialGradient id="kglow" cx="0.5" cy="0.45" r="0.6"><stop offset="0" stop-color="${sky.glow}" stop-opacity="0.55"/><stop offset="1" stop-color="${sky.glow}" stop-opacity="0"/></radialGradient>
    <radialGradient id="kvig" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#3a2a20" stop-opacity="0"/><stop offset="1" stop-color="#3a2a20" stop-opacity="0.28"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#ksky)"/>
  ${stars}
  <rect width="${W}" height="${H}" fill="url(#kglow)"/>
  <polygon points="0,300 90,210 170,270 260,190 360,260 450,200 540,250 540,340 0,340" fill="#b9c6e0" opacity="0.8"/>
  <path d="M90 210 L112 232 L100 228 L90 236 L80 228 L68 232 Z M260 190 L286 216 L272 212 L260 220 L248 212 L234 216 Z M450 200 L470 220 L458 217 L450 224 L442 217 L430 220 Z" fill="#ffffff"/>
  <path d="M0 330 Q140 300 270 322 T540 316 L540 560 L0 560 Z" fill="url(#kground)"/>
  ${far}
  ${MOTIF[main](r)}
  ${pine(36, 540, 1.25, "#2f5a54")}${pine(96, 560, 0.9, "#3a6a60")}${pine(512, 548, 1.15, "#2f5a54")}
  ${kawaiiBird(main === "sled" ? 300 : 420, main === "sled" ? 400 : 500, 0.42, "#ffb3d9")}
  ${flakes}
  <rect width="${W}" height="${H}" fill="#f6e7c8" opacity="0.12"/>
  <rect width="${W}" height="${H}" fill="url(#kvig)"/>`;
}
