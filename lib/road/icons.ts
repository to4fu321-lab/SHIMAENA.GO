// 道の危険のアイコン（11/6 本人の指示「言葉を読まないと分からないのは NG」）。
// 日本の道路の警告標識のような黄色い板いっぱいに、ひと目で分かる大きな絵を描く。画像生成 AI は使わず図形だけ。
// 画面（React）と地図（Leaflet の HTML）の両方で使うので、SVG の文字列で持つ。赤と緑は使わない（地図の「人手不足」と区別）。
import type { HazardId } from "./hazards";

export const HAZARD_AMBER = "#F7B731";
export const HAZARD_PIN = "#E8792F";
const INK = "#1f3448";
const SNOW = "#ffffff";
const ICE = "#9cc9dc";
const SLUSH = "#a7b4bf";
const W = `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"`;

/** 横向きの車（左向き）。x,y は車体の左下 */
const carSide = (x: number, y: number, tilt = 0) =>
  `<g transform="translate(${x} ${y}) rotate(${tilt})"><path d="M0 0 V-7 Q0 -10 3 -10 L8 -11 L13 -18 Q14 -19 16 -19 H28 Q30 -19 31 -17 L35 -11 H39 Q42 -11 42 -8 V0 Z" fill="${INK}"/><path d="M15 -16.5 H22 V-11.5 H11.5 Z M24 -16.5 H29 L32 -11.5 H24 Z" fill="${ICE}"/><circle cx="9" cy="0" r="5" fill="${INK}" stroke="${HAZARD_AMBER}" stroke-width="2"/><circle cx="33" cy="0" r="5" fill="${INK}" stroke="${HAZARD_AMBER}" stroke-width="2"/></g>`;

/** 絵（viewBox 0 0 64 64。板いっぱいに描く） */
const PICTO: Record<HazardId, string> = {
  // 除雪まだ: 除雪車と、まだ来ないことを表す時計。道には雪が積もったまま
  no_plow: `<path d="M5 52 C9 44 17 46 22 44 C28 42 30 47 36 46 C44 45 50 48 59 46 V58 H5 Z" fill="${SNOW}" ${W}/>
    <path d="M24 40 V27 Q24 24 27 24 H37 Q40 24 41 27 L43 33 H52 Q55 33 55 36 V40 Z" fill="${INK}"/>
    <path d="M28 27 H36 L38 32 H28 Z" fill="${ICE}"/>
    <path d="M24 36 H19" stroke="${INK}" stroke-width="3"/><path d="M20 27 Q11 31 12 46 L20 46 Q18 35 22 29 Z" fill="${INK}"/><path d="M17 30 Q13 35 14 43" fill="none" stroke="${ICE}" stroke-width="1.6" stroke-linecap="round"/>
    <circle cx="31" cy="42" r="4.5" fill="${INK}" stroke="${HAZARD_AMBER}" stroke-width="2"/><circle cx="48" cy="42" r="4.5" fill="${INK}" stroke="${HAZARD_AMBER}" stroke-width="2"/>
    <circle cx="14" cy="14" r="9" fill="${SNOW}" ${W}/><path d="M14 9 V14 L18 16.5" fill="none" ${W}/>`,
  // 道が細い: 両側の雪の壁が道をせばめ、車がぎりぎり（上から見た道が先で細くなる）
  narrow: `<path d="M24 6 H40 L50 58 H14 Z" fill="${SLUSH}"/>
    <path d="M5 58 V20 C12 22 20 30 26 58 Z" fill="${SNOW}" ${W}/><path d="M59 58 V20 C52 22 44 30 38 58 Z" fill="${SNOW}" ${W}/>
    <path d="M32 9 V15" stroke="${SNOW}" stroke-width="2.5" stroke-linecap="round"/>
    <rect x="22" y="36" width="20" height="16" rx="4" fill="${INK}"/><path d="M25 39 H39 L37.5 44 H26.5 Z" fill="${ICE}"/><circle cx="26.5" cy="48" r="1.8" fill="${HAZARD_AMBER}"/><circle cx="37.5" cy="48" r="1.8" fill="${HAZARD_AMBER}"/>
    <path d="M15 32 L20 36 M49 32 L44 36" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  // 歩道なし: 歩道が雪でうまり、人が車のすぐ横の車道を歩く
  no_sidewalk: `<path d="M4 58 V44 C10 38 18 40 22 46 C24 50 24 54 24 58 Z" fill="${SNOW}" ${W}/>
    <circle cx="16" cy="13" r="5" fill="${INK}"/>
    <path d="M16 20 L14 33 M14 33 L9 43 M14 33 L20 42 M16 22 L9 28 M16 22 L22 27" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    ${carSide(20, 54)}`,
  // ぐさぐさ: 車のタイヤがぐさぐさの雪にはまって空回り（はねる雪）
  slush: `${carSide(10, 40, -6)}
    <path d="M3 58 C6 48 12 46 18 49 C22 44 28 46 32 49 C38 45 44 46 48 50 C53 46 59 48 61 58 Z" fill="${SLUSH}" ${W}/>
    <circle cx="10" cy="40" r="2.6" fill="${SLUSH}" stroke="${INK}" stroke-width="1.6"/><circle cx="6" cy="33" r="2" fill="${SLUSH}" stroke="${INK}" stroke-width="1.6"/><circle cx="14" cy="31" r="1.8" fill="${SLUSH}" stroke="${INK}" stroke-width="1.6"/>
    <path d="M50 22 A9 9 0 0 1 57 32 M53 18 A14 14 0 0 1 61 31" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>`,
  // つるつる: 凍った道で足がすべって転ぶ人（光る氷）
  ice: `<path d="M3 52 H61 V58 H3 Z" fill="${ICE}" ${W}/><path d="M10 55 H22 M40 55 H50" stroke="${SNOW}" stroke-width="2" stroke-linecap="round"/>
    <circle cx="20" cy="15" r="5.5" fill="${INK}"/>
    <path d="M23 21 L33 33 M33 33 L48 30 M48 30 L56 24 M33 33 L36 44 M36 44 L46 46 M26 23 L14 29 M28 25 L38 15" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M52 40 L53.5 36 L55 40 L59 41.5 L55 43 L53.5 47 L52 43 L48 41.5 Z" fill="${SNOW}" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>`,
};

/** 黄色い警告の板（角の丸い四角）＋大きな絵。size は px */
export function hazardSvg(id: HazardId, size = 48): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><rect x="1.5" y="1.5" width="61" height="61" rx="12" fill="${HAZARD_AMBER}" stroke="${INK}" stroke-width="3"/><svg x="0" y="0" width="64" height="64" viewBox="0 0 64 64"><clipPath id="hzc-${id}"><rect x="3" y="3" width="58" height="58" rx="10.5"/></clipPath><g clip-path="url(#hzc-${id})">${PICTO[id]}</g></svg></svg>`;
}

/** 地図のピン（しずく形のオレンジ＋中に黄色い板のアイコン）。fresh なら足もとに脈打つ輪 */
export function hazardPinHtml(id: HazardId, label: string, fresh: boolean): string {
  return `<div class="hz-pin${fresh ? " hz-fresh" : ""}" aria-label="${label}"><span class="hz-halo"></span><svg viewBox="0 0 48 60" width="48" height="60" aria-hidden="true"><path d="M24 58 C24 58 3 37 3 22 A21 21 0 0 1 45 22 C45 37 24 58 24 58 Z" fill="${HAZARD_PIN}" stroke="#fff" stroke-width="3"/></svg><span class="hz-in">${hazardSvg(id, 30)}</span></div>`;
}
