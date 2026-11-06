// その時だけの場面（spec v1.8）: カードの絵に、その時の事実から決まる「場面の層」を重ねる。
// ・プログラムが事実から決める: 空（完了した時刻）・降る雪（雪質と予報）・積もった雪の高さ（推定の深さ）
// ・Claude が選ぶ: 持ち物2つ・雰囲気・「なぜこの絵か」の一文（lib/claude/card.ts。キーなしは事実から決まる選び方）
// 絵はプログラムが図形で描く（画像生成 AI は使わない）。同じ設計図は二度と出ない（その家・その時の ID を混ぜた番号）。
import { createHash } from "node:crypto";
import type { SnowType } from "../types";

export const SCENE_PROPS = ["shovel", "tea", "lantern", "sled", "snowman", "sand"] as const;
export const MOODS = ["calm", "lively", "heroic"] as const;
export type SceneProp = (typeof SCENE_PROPS)[number];
export type Mood = (typeof MOODS)[number];
export type SceneSky = "dawn" | "day" | "dusk" | "night";
export type SceneFall = "none" | "powder" | "flakes" | "heavy";

export const PROP_LABEL: Record<SceneProp, string> = { shovel: "スコップ", tea: "お茶", lantern: "ランタン", sled: "そり", snowman: "雪だるま", sand: "砂まき" };
export const SKY_LABEL: Record<SceneSky, string> = { dawn: "朝焼け", day: "昼の光", dusk: "夕暮れ", night: "夜" };
export const FALL_LABEL: Record<SceneFall, string> = { none: "やんだ雪", powder: "粉雪", flakes: "ぼた雪", heavy: "大雪" };

export interface SceneFacts {
  sky: SceneSky;
  fall: SceneFall;
  /** 積もった雪の高さ（0〜3） */
  ground: 0 | 1 | 2 | 3;
}

export interface CardScene extends SceneFacts {
  props: SceneProp[];
  mood: Mood;
  /** なぜこの絵か（40字まで） */
  why: string;
  /** この時だけの設計図の番号（4桁の16進） */
  code: string;
  /** v1.23: 今日の話題（時事）と、それから描いた挿絵（ステッカー）。前の版のカードにはない */
  topic?: string;
  motif?: import("./motif").Motif;
}

export const WHY_MAX = 40;

/** 事実から決まる部分（AI は使わない） */
export function sceneFacts(i: { completedHour: number; snowType?: SnowType; forecastCm: number; depthCm: number }): SceneFacts {
  const h = i.completedHour;
  const sky: SceneSky = h < 7 ? "dawn" : h < 15 ? "day" : h < 17 ? "dusk" : "night";
  const fall: SceneFall = i.forecastCm >= 20 ? "heavy" : i.forecastCm <= 0 || i.snowType === "icy" ? "none" : i.snowType === "wet" ? "flakes" : "powder";
  const ground = (i.depthCm < 5 ? 0 : i.depthCm < 15 ? 1 : i.depthCm < 30 ? 2 : 3) as SceneFacts["ground"];
  return { sky, fall, ground };
}

/** キーがないときの選び方（事実から決まる。毎回同じ） */
export function mockSceneChoice(f: SceneFacts, i: { thanks?: boolean; members: number; mixed: boolean }): { props: SceneProp[]; mood: Mood; why: string } {
  const props: SceneProp[] = [f.ground >= 2 ? "shovel" : "sand"];
  props.push(i.thanks ? "tea" : f.sky === "dusk" || f.sky === "night" ? "lantern" : f.fall === "powder" ? "snowman" : "sled");
  const mood: Mood = f.fall === "heavy" || f.ground === 3 ? "heroic" : i.members >= 3 || i.mixed ? "lively" : "calm";
  const why = `${SKY_LABEL[f.sky]}の${FALL_LABEL[f.fall]}に、${i.members}羽で${PROP_LABEL[props[0]]}と${PROP_LABEL[props[1]]}`;
  return { props, mood, why: why.slice(0, WHY_MAX) };
}

/** Claude の選んだものを、使ってよい形にそろえる（候補の外は捨てる・2つまで・夜でないのにランタン…はそのままでよい） */
export function tidySceneChoice(c: { props?: string[]; mood?: string; why?: string }, fallback: { props: SceneProp[]; mood: Mood; why: string }, allowedNumbers: number[]) {
  const props = [...new Set((c.props ?? []).filter((p): p is SceneProp => (SCENE_PROPS as readonly string[]).includes(p)))].slice(0, 2);
  const mood = (MOODS as readonly string[]).includes(c.mood ?? "") ? (c.mood as Mood) : fallback.mood;
  let why = (c.why ?? "").replace(/\s+/g, "").slice(0, WHY_MAX);
  const numbersOk = (why.match(/\d+/g) ?? []).every((n) => allowedNumbers.includes(Number(n)));
  if (!why || !numbersOk || /さん|様|拠点|番地|丁目/.test(why)) why = fallback.why;
  return { props: props.length === 2 ? props : fallback.props, mood, why };
}

/** この時だけの設計図の番号（その家・その時・場面から。同じものは二度と出ない） */
export function sceneCode(seed: string, s: Omit<CardScene, "code" | "why">): string {
  return createHash("sha256").update(`${seed}|${s.sky}|${s.fall}|${s.ground}|${s.props.join(",")}|${s.mood}`).digest("hex").slice(0, 4);
}

/** 番号から決まる、毎回同じ乱数 */
function rng(code: string) {
  let a = parseInt(code, 16) + 1;
  return () => {
    a = (a * 1103515245 + 12345) & 0x7fffffff;
    return a / 0x7fffffff;
  };
}

const TINT: Record<SceneSky, [string, number]> = { dawn: ["#ff9f6e", 0.22], day: ["#fff7d6", 0.08], dusk: ["#a76bff", 0.2], night: ["#1d2f60", 0.34] };

function propSvg(p: SceneProp, x: number, y: number): string {
  const g = (inner: string) => `<g transform="translate(${x} ${y})">${inner}</g>`;
  switch (p) {
    case "shovel":
      return g(`<path d="M0 -40 L6 6" stroke="#8a6a4a" stroke-width="6" stroke-linecap="round"/><path d="M-10 2 L18 -4 L22 22 L-6 28 Z" fill="#ff8a3d" stroke="#3b2a78" stroke-width="2"/>`);
    case "tea":
      return g(`<path d="M-14 -6 h28 v16 a14 14 0 0 1 -28 0 Z" fill="#fff" stroke="#3b2a78" stroke-width="2"/><path d="M14 0 a7 7 0 0 1 0 12" fill="none" stroke="#3b2a78" stroke-width="2"/><path d="M-6 -12 q4 -8 0 -16 M4 -12 q4 -8 0 -16" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>`);
    case "lantern":
      return g(`<rect x="-10" y="-20" width="20" height="28" rx="6" fill="#ffd36e" stroke="#3b2a78" stroke-width="2"/><circle cx="0" cy="-6" r="16" fill="#ffd36e" opacity="0.35"/><path d="M-6 -26 h12" stroke="#3b2a78" stroke-width="3"/>`);
    case "sled":
      return g(`<path d="M-24 0 h40 a8 8 0 0 0 8 -8" fill="none" stroke="#3b2a78" stroke-width="3" stroke-linecap="round"/><rect x="-20" y="-12" width="34" height="8" rx="3" fill="#ff7ab8" stroke="#3b2a78" stroke-width="2"/>`);
    case "snowman":
      return g(`<circle cx="0" cy="0" r="14" fill="#fff" stroke="#9fb8d8" stroke-width="2"/><circle cx="0" cy="-20" r="10" fill="#fff" stroke="#9fb8d8" stroke-width="2"/><circle cx="-3" cy="-22" r="1.5" fill="#3b2a78"/><circle cx="3" cy="-22" r="1.5" fill="#3b2a78"/><path d="M0 -19 l6 2 l-6 1 Z" fill="#ff8a3d"/><path d="M-9 -12 h18" stroke="#ff7ab8" stroke-width="3"/>`);
    case "sand":
      return g(`<path d="M-12 -14 h24 l-4 26 h-16 Z" fill="#e8c890" stroke="#3b2a78" stroke-width="2"/><g fill="#c9a36a"><circle cx="-18" cy="16" r="2"/><circle cx="-8" cy="20" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="14" r="2"/></g>`);
  }
}

/** 場面の層（絵の枠 x30〜570・y30〜590 の内側。クリップの id は各タッチの "pic"） */
export function sceneLayer(s: CardScene): string {
  const r = rng(s.code);
  const [tint, op] = TINT[s.sky];
  const orb =
    s.sky === "dawn" || s.sky === "day"
      ? `<circle cx="96" cy="96" r="26" fill="#ffd36e" opacity="0.85"/>`
      : `<circle cx="96" cy="96" r="22" fill="#fff6c8" opacity="0.9"/><circle cx="106" cy="88" r="20" fill="${tint}" opacity="0.9"/>`;
  const n = { none: 0, powder: 28, flakes: 16, heavy: 44 }[s.fall];
  const size = { none: [0, 0], powder: [1.5, 2.6], flakes: [3, 5], heavy: [2, 4] }[s.fall];
  const flakes = Array.from({ length: n }, () => {
    const x = 40 + r() * 520;
    const y = 40 + r() * 420;
    const rad = size[0] + r() * (size[1] - size[0]);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="#fff" opacity="${(0.6 + r() * 0.35).toFixed(2)}"/>`;
  }).join("");
  const h = [0, 16, 28, 42][s.ground];
  const drifts =
    h > 0
      ? `<path d="M30 590 V${590 - h} q40 -${h / 2} 90 -4 q30 6 40 ${h + 4} Z" fill="#fff" opacity="0.92"/><path d="M570 590 V${590 - h} q-40 -${h / 2} -90 -4 q-30 6 -40 ${h + 4} Z" fill="#fff" opacity="0.92"/>`
      : "";
  const sparkles =
    s.mood === "lively"
      ? Array.from({ length: 5 }, () => {
          const x = 60 + r() * 480;
          const y = 60 + r() * 300;
          return `<path d="M${x.toFixed(0)} ${(y - 8).toFixed(0)} l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 l6 -2 Z" fill="#fff27a" opacity="0.9"/>`;
        }).join("")
      : s.mood === "heroic"
        ? `<g stroke="#fff" stroke-width="10" opacity="0.12">${[0, 1, 2, 3, 4].map((i) => `<path d="M300 30 L${80 + i * 110} 590"/>`).join("")}</g>`
        : "";
  const props = `${propSvg(s.props[0] ?? "shovel", 68, 560 - h / 2)}${propSvg(s.props[1] ?? "tea", 532, 560 - h / 2)}`;
  return `
  <g clip-path="url(#pic)" data-scene="${s.code}">
    <rect x="30" y="30" width="540" height="560" fill="${tint}" opacity="${op}"/>
    ${orb}${sparkles}${flakes}${drifts}${props}
  </g>`;
}
