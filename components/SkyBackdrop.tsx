// ホームの背景: 天気と時間で空の色・太陽／月／星・降る雪・家の灯りが変わる（lib/sky.ts）
import { SnowTown } from "@/components/Mascot";
import { skyColors, type Sky } from "@/lib/sky";

// 降る雪の粒（位置・大きさ・速さ・遅れ）。毎回同じ並びにして、サーバーと画面で食い違わないように
const FLAKES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 3 + ((i * 7) % 4),
  dur: 6 + ((i * 5) % 6),
  delay: -((i * 13) % 11),
}));

const STARS = [
  [12, 10], [28, 22], [46, 8], [63, 18], [78, 6], [90, 24], [36, 34], [70, 32],
];

export default function SkyBackdrop({ sky }: { sky: Sky }) {
  const [top, bottom] = skyColors(sky);
  const dark = sky.time === "night" || sky.time === "dusk";
  const night = sky.time === "night";
  return (
    <div className="absolute inset-0" aria-hidden="true" style={{ background: `linear-gradient(180deg, ${top} 0%, ${bottom} 100%)` }}>
      {/* 太陽・月・星（晴れとくもりのとき） */}
      {sky.weather === "clear" && night &&
        STARS.map(([x, y], i) => (
          <span key={i} className="sky-star absolute size-1 rounded-full bg-white" style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${i * 0.4}s` }} />
        ))}
      {sky.weather !== "snow" && (
        <span
          className="absolute left-[8%] top-[30%] size-10 rounded-full"
          style={
            night
              ? { background: "#f4f1de", boxShadow: "0 0 18px 4px rgba(244,241,222,.45)", opacity: sky.weather === "cloudy" ? 0.5 : 1 }
              : {
                  background: sky.time === "day" ? "#fff6d6" : "#ffd59e",
                  boxShadow: `0 0 28px 10px ${sky.time === "day" ? "rgba(255,246,214,.7)" : "rgba(255,190,120,.6)"}`,
                  opacity: sky.weather === "cloudy" ? 0.45 : 1,
                }
          }
        />
      )}
      {/* くもり・雪: 雲 */}
      {sky.weather !== "clear" && (
        <svg viewBox="0 0 400 80" preserveAspectRatio="none" className="absolute inset-x-0 top-0 h-1/3 w-full">
          <g fill={dark ? "#6b7a8f" : "#ffffff"} opacity={dark ? 0.55 : 0.75}>
            <ellipse cx="70" cy="22" rx="70" ry="20" />
            <ellipse cx="160" cy="12" rx="80" ry="18" />
            <ellipse cx="300" cy="20" rx="90" ry="22" />
            <ellipse cx="390" cy="10" rx="60" ry="16" />
          </g>
        </svg>
      )}
      {/* 雪のとき: 降る雪 */}
      {sky.weather === "snow" &&
        FLAKES.map((f, i) => (
          <span
            key={i}
            className="sky-flake absolute -top-2 rounded-full bg-white"
            style={{ left: `${f.left}%`, width: f.size, height: f.size, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, opacity: 0.9 }}
          />
        ))}
      <SnowTown tower dark={dark} className="absolute inset-x-0 bottom-0 h-[70%] w-full" />
    </div>
  );
}
