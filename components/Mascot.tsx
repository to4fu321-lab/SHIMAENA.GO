// シマエナガのキャラクター（オレンジのマフラー）。画像ファイルを使わず SVG で描く。
// mood: normal = いつもの顔、happy = 目を細めて喜ぶ顔（完了の画面）
export default function Mascot({ size = 120, mood = "normal", className = "" }: { size?: number; mood?: "normal" | "happy"; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} aria-hidden="true" className={className}>
      {/* しっぽ */}
      <path d="M96 70 L116 62 L112 78 Z" fill="#29445c" />
      {/* からだ */}
      <ellipse cx="60" cy="64" rx="44" ry="42" fill="#ffffff" stroke="#dbe6ee" strokeWidth="2" />
      {/* つばさ */}
      <path d="M88 52 C104 62 104 86 86 96 C90 82 88 66 80 56 Z" fill="#29445c" />
      <path d="M32 56 C20 66 22 84 34 92 C32 80 34 66 40 58 Z" fill="#3b6584" />
      {/* 目 */}
      {mood === "happy" ? (
        <>
          <path d="M40 54 Q45 48 50 54" fill="none" stroke="#1d2f40" strokeWidth="3.4" strokeLinecap="round" />
          <path d="M70 54 Q75 48 80 54" fill="none" stroke="#1d2f40" strokeWidth="3.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="45" cy="54" r="4.6" fill="#1d2f40" />
          <circle cx="75" cy="54" r="4.6" fill="#1d2f40" />
          <circle cx="46.4" cy="52.6" r="1.4" fill="#fff" />
          <circle cx="76.4" cy="52.6" r="1.4" fill="#fff" />
        </>
      )}
      {/* くちばし */}
      <path d="M56 60 L64 60 L60 66 Z" fill="#1d2f40" />
      {/* ほっぺ */}
      <ellipse cx="36" cy="64" rx="6" ry="3.6" fill="#f2b8bf" opacity="0.8" />
      <ellipse cx="84" cy="64" rx="6" ry="3.6" fill="#f2b8bf" opacity="0.8" />
      {/* マフラー */}
      <path d="M22 76 C40 88 80 88 98 76 L98 86 C80 98 40 98 22 86 Z" fill="#e8834f" />
      <path d="M70 88 L78 112 L90 108 L84 86 Z" fill="#d06d3b" />
      <path d="M26 80 C42 90 78 90 94 80" fill="none" stroke="#f6a57a" strokeWidth="2" />
    </svg>
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
