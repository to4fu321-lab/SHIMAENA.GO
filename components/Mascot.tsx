// シマエナガのキャラクター。画像ファイルを使わず SVG で描く（絵は lib/mascot-svg.ts）。
// mood: normal = いつもの顔、happy = 目を細めて喜ぶ顔（完了の画面）
// team: 1週間のチーム。マフラーがチームの色になる（なければいつもの灯りオレンジ）
import { mascotInner } from "@/lib/mascot-svg";
import { scarfOf } from "@/lib/team-theme";
import type { TeamId } from "@/lib/types";

export default function Mascot({
  size = 120,
  mood = "normal",
  team,
  className = "",
}: {
  size?: number;
  mood?: "normal" | "happy";
  team?: TeamId;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
      className={className}
      dangerouslySetInnerHTML={{ __html: mascotInner(mood, scarfOf(team)) }}
    />
  );
}

/** 雪の町（家と木の並び）。見出しや画面の下の飾り */
export function SnowTown({ className = "", tower = false }: { className?: string; tower?: boolean }) {
  return (
    <svg viewBox="0 0 400 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true" className={className}>
      {tower && (
        <g stroke="#8fa9bf" strokeWidth="2.2" fill="none">
          <path d="M40 112 L52 20 L64 112" />
          <path d="M44 84 H60 M47 60 H57 M49 40 H55" />
          <path d="M52 20 V6" />
        </g>
      )}
      {/* 木 */}
      {[[18, 0.9], [96, 1.1], [300, 1], [372, 1.2], [250, 0.8]].map(([x, s], i) => (
        <path key={i} d={`M${x} ${112 - 46 * s} L${x + 14 * s} ${112 - 10 * s} H${x - 14 * s} Z`} fill="#a9c1d4" />
      ))}
      {/* 家 */}
      {[
        [110, 40, 34],
        [160, 30, 28],
        [200, 46, 38],
        [262, 34, 30],
        [320, 40, 34],
      ].map(([x, w, h], i) => (
        <g key={i}>
          <path d={`M${x} ${112 - h + 12} L${x + w / 2} ${112 - h - 6} L${x + w} ${112 - h + 12} V112 H${x} Z`} fill="#c9d8e4" />
          <path d={`M${x - 3} ${112 - h + 13} L${x + w / 2} ${112 - h - 8} L${x + w + 3} ${112 - h + 13}`} fill="none" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
          <rect x={x + w / 2 - 5} y={112 - h + 18} width="10" height="9" rx="1.5" fill="#f3c48a" />
        </g>
      ))}
      {/* 雪の地面 */}
      <path d="M0 108 C80 98 160 112 240 104 C300 98 360 106 400 102 V120 H0 Z" fill="#ffffff" />
    </svg>
  );
}
