// シマエナガの絵（SVG の中身）。画面（components/Mascot.tsx）と LINE の画像（lib/team-announce.ts）で同じ絵を使う。
// マフラーの色は1週間のチームの色（チームがない人はいつもの灯りオレンジ）。
import { DEFAULT_SCARF } from "./team-theme";

export type Mood = "normal" | "happy";

export interface Scarf {
  color: string;
  shade: string;
  light: string;
}

/** viewBox="0 0 120 120" の中身 */
export function mascotInner(mood: Mood = "normal", scarf: Scarf = DEFAULT_SCARF): string {
  const eyes =
    mood === "happy"
      ? `<path d="M40 54 Q45 48 50 54" fill="none" stroke="#1d2f40" stroke-width="3.4" stroke-linecap="round"/><path d="M70 54 Q75 48 80 54" fill="none" stroke="#1d2f40" stroke-width="3.4" stroke-linecap="round"/>`
      : `<circle cx="45" cy="54" r="4.6" fill="#1d2f40"/><circle cx="75" cy="54" r="4.6" fill="#1d2f40"/><circle cx="46.4" cy="52.6" r="1.4" fill="#fff"/><circle cx="76.4" cy="52.6" r="1.4" fill="#fff"/>`;
  return [
    `<path d="M96 70 L116 62 L112 78 Z" fill="#29445c"/>`, // しっぽ
    `<ellipse cx="60" cy="64" rx="44" ry="42" fill="#ffffff" stroke="#dbe6ee" stroke-width="2"/>`, // からだ
    `<path d="M88 52 C104 62 104 86 86 96 C90 82 88 66 80 56 Z" fill="#29445c"/>`, // つばさ
    `<path d="M32 56 C20 66 22 84 34 92 C32 80 34 66 40 58 Z" fill="#3b6584"/>`,
    eyes,
    `<path d="M56 60 L64 60 L60 66 Z" fill="#1d2f40"/>`, // くちばし
    `<ellipse cx="36" cy="64" rx="6" ry="3.6" fill="#f2b8bf" opacity="0.8"/>`, // ほっぺ
    `<ellipse cx="84" cy="64" rx="6" ry="3.6" fill="#f2b8bf" opacity="0.8"/>`,
    `<path d="M22 76 C40 88 80 88 98 76 L98 86 C80 98 40 98 22 86 Z" fill="${scarf.color}"/>`, // マフラー
    `<path d="M70 88 L78 112 L90 108 L84 86 Z" fill="${scarf.shade}"/>`,
    `<path d="M26 80 C42 90 78 90 94 80" fill="none" stroke="${scarf.light}" stroke-width="2"/>`,
  ].join("");
}
