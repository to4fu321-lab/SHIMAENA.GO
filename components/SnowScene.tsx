// はじめての人に見せる雪の町の背景（/start・/login・オープニング）。音や状態を持たないので server でも使える。
// phase: night = 雪の夜（星・窓は暗い）／dawn = 夜が明けて、日がのぼり、家の灯りが1軒ずつともる
// 動きは CSS だけ（globals.css「はじめての演出」）。動きを減らす設定の人には止まった絵で出る。

// 降る雪の粒（毎回同じ並び。サーバーと画面で食い違わないように）
const FLAKES = Array.from({ length: 36 }, (_, i) => ({
  left: (i * 29 + 7) % 100,
  size: 3 + ((i * 7) % 5),
  dur: 7 + ((i * 5) % 7),
  delay: -((i * 13) % 13),
  drift: ((i * 11) % 30) - 10,
}));
const STARS = [
  [8, 8], [22, 18], [40, 6], [58, 14], [74, 5], [90, 16], [32, 28], [66, 26], [84, 32], [14, 34],
];
// 家: [x, 幅, 高さ]（viewBox 400x160 の下に並ぶ）
const HOUSES = [
  [6, 44, 40], [58, 36, 32], [102, 52, 48], [164, 40, 36], [212, 56, 52], [278, 38, 34], [324, 48, 44], [380, 40, 36],
];
const TREES = [[48, 0.8], [150, 1], [270, 0.9], [372, 1.1]];

export default function SnowScene({ phase = "night", className = "" }: { phase?: "night" | "dawn"; className?: string }) {
  const dawn = phase === "dawn";
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      {/* 夜の空 → 夜明けの空（重ねて、明けの空をふわっと出す） */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #0c1c2e 0%, #1d3a58 55%, #3a5f82 100%)" }} />
      <div
        className={`absolute inset-0 ${dawn ? "opening-dawn" : "opacity-0"}`}
        style={{ background: "linear-gradient(180deg, #8cc3e8 0%, #c9e2f2 38%, #ffd8b4 72%, #ffc08f 100%)" }}
      />
      {/* 星（夜が明けると消える） */}
      {STARS.map(([x, y], i) => (
        <span
          key={i}
          className={`sky-star absolute size-1 rounded-full bg-white ${dawn ? "opening-fade-out" : ""}`}
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.3}s` }}
        />
      ))}
      {/* 日の出 */}
      {dawn && (
        <span
          className="opening-sun absolute left-1/2 size-28 rounded-full"
          style={{ bottom: "14%", marginLeft: -56, background: "radial-gradient(circle, #fff7e0 0%, #ffd27a 55%, rgba(255,210,122,0) 72%)" }}
        />
      )}
      {/* 降る雪 */}
      {FLAKES.map((f, i) => (
        <span
          key={i}
          className="opening-flake absolute -top-3 rounded-full bg-white"
          style={{
            left: `${f.left}%`,
            width: f.size,
            height: f.size,
            opacity: 0.55 + (f.size - 3) * 0.1,
            animationDuration: `${f.dur}s`,
            animationDelay: `${f.delay}s`,
            ["--drift" as string]: `${f.drift}px`,
          }}
        />
      ))}
      {/* 雪の町: 夜は窓が暗く、夜明けで1軒ずつ灯りがともる */}
      <svg viewBox="0 0 400 160" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-[34%] w-full">
        <path d="M0 96 C70 70 140 92 210 78 C280 64 340 84 400 72 V160 H0 Z" fill={dawn ? "#dfeaf3" : "#2c4a68"} className="transition-[fill] duration-[2000ms]" />
        {TREES.map(([x, s], i) => (
          <path key={i} d={`M${x} ${148 - 56 * s} L${x + 16 * s} ${148 - 8 * s} H${x - 16 * s} Z`} fill={dawn ? "#a9c1d4" : "#3d5d7c"} className="transition-[fill] duration-[2000ms]" />
        ))}
        {HOUSES.map(([x, w, h], i) => (
          <g key={i}>
            <path d={`M${x} ${150 - h + 14} L${x + w / 2} ${150 - h - 6} L${x + w} ${150 - h + 14} V152 H${x} Z`} fill={dawn ? "#c9d8e4" : "#4a6886"} className="transition-[fill] duration-[2000ms]" />
            <path d={`M${x - 3} ${150 - h + 15} L${x + w / 2} ${150 - h - 8} L${x + w + 3} ${150 - h + 15}`} fill="none" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
            <rect
              x={x + w / 2 - 6}
              y={150 - h + 22}
              width="12"
              height="11"
              rx="2"
              className={dawn ? "opening-window" : ""}
              fill={dawn ? undefined : "#24384d"}
              style={dawn ? { animationDelay: `${0.5 + i * 0.22}s` } : undefined}
            />
          </g>
        ))}
        <path d="M0 148 C80 138 160 154 240 144 C300 138 360 148 400 142 V160 H0 Z" fill="#ffffff" />
      </svg>
    </div>
  );
}
