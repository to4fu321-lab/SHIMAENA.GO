// 道の危険のアイコン（11/6 本人の指示「添付のような分かりやすい UI に」）。警告標識のような三角の中に、雪国の5つの危険の絵。
// 画面（React）と地図（Leaflet の HTML）の両方で使うので、SVG の文字列で持つ。画像生成 AI は使わず図形だけ。
// 色: 三角は注意の黄色、絵は冬の深い青。赤と緑は使わない（地図の状態色「人手不足」と区別するため）。
import type { HazardId } from "./hazards";

export const HAZARD_AMBER = "#F5A524";
export const HAZARD_PIN = "#E8792F";
const INK = "#29445c";
const SNOW = "#ffffff";

/** 三角の中の絵（viewBox 0 0 64 64。三角の内側 y=22〜54 に収める） */
const PICTO: Record<HazardId, string> = {
  // 除雪がまだ: 道をふさぐ雪の山
  no_plow: `<path d="M12 53 C13 43 20 37 27 39 C31 31 41 32 44 39 C50 38 54 45 53 53 Z" fill="${SNOW}" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/><path d="M24 46 C27 44 30 44 32 45 M36 44 C39 42 42 43 44 45" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/><path d="M32 22 V30 M28.5 24 L35.5 28 M35.5 24 L28.5 28" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>`,
  // 道が細い: 雪の壁にはさまれた車
  narrow: `<path d="M9 53 C11 44 14 38 19 36 L21 53 Z M55 53 C53 44 50 38 45 36 L43 53 Z" fill="${SNOW}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><rect x="24" y="37" width="16" height="13" rx="3.5" fill="${INK}"/><rect x="26.5" y="39.5" width="11" height="4.5" rx="1.5" fill="${HAZARD_AMBER}"/><rect x="25" y="49" width="4" height="4" rx="1" fill="${INK}"/><rect x="35" y="49" width="4" height="4" rx="1" fill="${INK}"/><path d="M27 30 L32 25 L37 30" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  // 歩道がない: 歩く人と、歩道をうめた雪
  no_sidewalk: `<circle cx="29" cy="25.5" r="3.6" fill="${INK}"/><path d="M28.5 30 L26.5 41 M26.5 41 L22 52 M26.5 41 L31 51 M28 32 L22.5 37 M28 32 L34 36.5" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 53 C36 44 42 40 48 41 C52 43 54 48 55 53 Z" fill="${SNOW}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
  // ぐさぐさ雪・スタック注意: ぐさぐさの雪にはまって空回りするタイヤ
  slush: `<circle cx="32" cy="38" r="9" fill="${INK}"/><circle cx="32" cy="38" r="3.4" fill="${HAZARD_AMBER}"/><path d="M19.5 33 A13 13 0 0 1 25 26.5 M44.5 33 A13 13 0 0 0 39 26.5" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M11 53 C14 46 19 49 23 46 C27 49 31 45 35 48 C39 45 44 49 47 46 C50 48 52 50 53 53 Z" fill="#c9d8e4" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/>`,
  // 凍って転びやすい: すべる人と、光る氷
  ice: `<circle cx="25" cy="26.5" r="3.6" fill="${INK}"/><path d="M27.5 30.5 L35 37.5 M35 37.5 L45 35.5 M35 37.5 L29 45 M28.5 32.5 L21.5 36.5 M30.5 33.5 L37 28.5" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 51 H53" stroke="#8fb8c9" stroke-width="4.5" stroke-linecap="round"/><path d="M44 45 L45 42.5 L46 45 L48.5 46 L46 47 L45 49.5 L44 47 L41.5 46 Z" fill="#8fb8c9"/>`,
};

/** 警告標識のような三角（黄色）＋中の絵。size は px */
export function hazardSvg(id: HazardId, size = 48): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><path d="M32 5 L60.5 55 Q62 58.5 58 58.5 H6 Q2 58.5 3.5 55 Z" fill="${HAZARD_AMBER}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>${PICTO[id]}</svg>`;
}

/** 地図のピン（しずく形のオレンジ＋白い丸の中に三角のアイコン）。new なら足もとに脈打つ輪 */
export function hazardPinHtml(id: HazardId, label: string, fresh: boolean): string {
  return `<div class="hz-pin${fresh ? " hz-fresh" : ""}" aria-label="${label}"><span class="hz-halo"></span><svg viewBox="0 0 48 60" width="44" height="55" aria-hidden="true"><path d="M24 58 C24 58 4 37 4 22 A20 20 0 0 1 44 22 C44 37 24 58 24 58 Z" fill="${HAZARD_PIN}" stroke="#fff" stroke-width="3"/><circle cx="24" cy="22" r="15" fill="#fff"/></svg><span class="hz-in">${hazardSvg(id, 26)}</span></div>`;
}
