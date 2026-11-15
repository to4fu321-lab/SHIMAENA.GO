"use client";

// 全軒 完了！（spec v1.66）: 今朝の家がすべて終わった瞬間のお祝い。地図を見ている人にはその場で、
// あとから来た人には通知・隊長トークのボタン（/map?fin=1）か、地図を開いたとき（その朝に1回）に出る。
// 勝利のファンファーレ → 家の灯りが1軒ずつともる → 数字（軒・人・チーム）→ シマエナ隊長の声。
// 数字はプログラムが数えたもの（lib/morning/all-clear.ts）。自分の「1軒 完了！」が出ている間は待って、そのあとに出す。
import { useEffect, useState, useSyncExternalStore } from "react";
import { allClearLine, allClearVoiceText, type AllClearStats } from "@/lib/morning/all-clear";
import { play, soundPrefs } from "@/lib/sound/engine";
import { speakCaptain, stopCaptainVoice } from "./ChatTools";
import { useHouseClearOpen } from "./ClearWatcher";
import Mascot from "./Mascot";

const CONFETTI = ["#ffd27a", "#8fb8d9", "#c8a7b8", "#ffffff", "#f0a070"];

// ---- 出す・閉じる（このタブの中で1つ） ----
let wanted = false;
let lastLive = false; // 前に見たとき、まだ終わっていなかった（＝その場で終わるのを見た）
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  return () => void listeners.delete(cb);
};
function want(v: boolean): void {
  wanted = v;
  listeners.forEach((l) => l());
}

const seenKey = (date: string) => `shimaena:allClear:${date}`;
function seen(date: string): boolean {
  try {
    return localStorage.getItem(seenKey(date)) !== null;
  } catch {
    return true; // 覚えられない端末では、開くたびに出さない（その場の完了と通知からは出る）
  }
}
function remember(date: string): void {
  try {
    localStorage.setItem(seenKey(date), "1");
  } catch {
    /* 覚えられなくても表示はできる */
  }
}

export interface AllClearHouse {
  number: number | string;
  color?: string;
}

export default function AllClearWatcher({
  stats,
  date,
  houses,
  joined,
  fin,
  recap,
  onSummary,
}: {
  /** すべて完了していれば数字。まだなら null */
  stats: AllClearStats | null;
  /** 今朝の日付（その朝に1回だけ出すための印） */
  date: string;
  /** 今朝の家（番号とチームの色） */
  houses: AllClearHouse[];
  /** 画面を見ている人が、今朝の雪かきに行ったか */
  joined: boolean;
  /** 通知・隊長トークのボタンから開いた（見たあとでも、もう一度出す） */
  fin: boolean;
  /** 今朝の実況（書けていれば） */
  recap?: string;
  /** 「今日のまとめを見る」（自分のまとめがある人だけ） */
  onSummary?: () => void;
}) {
  const open = useSyncExternalStore(subscribe, () => wanted, () => false);
  const houseOpen = useHouseClearOpen();
  const done = stats !== null;

  useEffect(() => {
    if (!done) {
      lastLive = true;
      return;
    }
    const live = lastLive;
    lastLive = false;
    if (!(fin || live || (joined && !seen(date)))) return;
    // 少し待つ: 自分が最後の1軒を終えたときは、先に「1軒 完了！」が出る（その画面が閉じてから出す）
    const t = setTimeout(() => want(true), live ? 1200 : 300);
    return () => clearTimeout(t);
  }, [done, fin, joined, date]);

  if (!open || !stats || houseOpen) return null;
  const close = () => {
    want(false);
    // 通知から開いた印（?fin=1）を消す: 開き直しても、もう一度は出さない
    if (fin) {
      const u = new URL(window.location.href);
      u.searchParams.delete("fin");
      window.history.replaceState(null, "", u.pathname + u.search);
    }
  };
  return (
    <AllClear
      stats={stats}
      houses={houses}
      recap={recap}
      onShown={() => remember(date)}
      onClose={close}
      onSummary={
        onSummary
          ? () => {
              close();
              onSummary();
            }
          : undefined
      }
    />
  );
}

function AllClear({ stats, houses, recap, onShown, onClose, onSummary }: { stats: AllClearStats; houses: AllClearHouse[]; recap?: string; onShown: () => void; onClose: () => void; onSummary?: () => void }) {
  // 家の灯りを1軒ずつともす
  const [lit, setLit] = useState(0);
  const step = Math.min(160, 1400 / Math.max(1, houses.length));
  useEffect(() => {
    onShown();
    play("bossDown");
    const timers = houses.map((_, i) =>
      setTimeout(() => {
        setLit(i + 1);
        play("countPop", { gain: 0.6 });
      }, 1500 + i * step),
    );
    const end = setTimeout(() => {
      setLit(999);
      play("lamp");
    }, 1500 + houses.length * step + 150);
    // シマエナ隊長の声。効果音を切っている人には読まない
    const voice = setTimeout(() => {
      if (soundPrefs().sfx) speakCaptain(allClearVoiceText(stats));
    }, 2000);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(end);
      clearTimeout(voice);
      stopCaptainVoice();
    };
    // 開いたときに1回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const all = lit === 999;
  const tiles: [string, string][] = [
    [`${stats.houses}`, "軒"],
    [`${stats.people}`, "人"],
    [`${stats.teams}`, "チーム"],
  ];

  return (
    <div className="fixed inset-0 z-[1300] mx-auto flex max-w-md flex-col overflow-hidden bg-ink/95 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] text-white backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="今朝の家 全軒完了">
      <span className="flash-rays pointer-events-none absolute left-1/2 top-[24%] size-[180vmax]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => (
          <span key={i} className="confetti" style={{ left: `${(i * 37 + 5) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 11) * 0.28}s` }} />
        ))}
      </div>

      {/* 上: はんこ */}
      <div className="relative shrink-0 text-center">
        <Mascot size={96} mood="happy" className="team-reveal mx-auto short:hidden" />
        <p className="flash-stamp mt-1 inline-block whitespace-nowrap rounded-2xl border-4 border-[#ffd27a] px-4 py-0.5 text-5xl font-black text-[#ffd27a]">全軒 完了！</p>
        <p className="flash-sub mt-3 text-xl font-bold leading-snug">
          <span className="block truncate">今朝の雪{stats.snowName ? `『${stats.snowName}』` : ""}</span>
          みんなでやっつけました！{stats.at ? <span className="ml-1 whitespace-nowrap text-base font-normal text-white/80">{stats.at}</span> : null}
        </p>
      </div>

      {/* 真ん中: 家の灯り・数字・実況 */}
      <section className="flash-sub relative mt-3 flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-hidden rounded-3xl bg-card px-4 py-3 text-ink shadow-xl" aria-label="今朝の結果">
        <ul className="flex flex-wrap justify-center gap-1.5" aria-label={`今朝の家 ${stats.houses}軒すべて完了`}>
          {houses.map((h, i) => {
            const on = i < lit;
            return (
              <li
                key={h.number}
                className={`grid size-10 place-items-center rounded-xl text-base font-bold tabular-nums transition-all duration-300 ${on ? "scale-100 text-white shadow-[0_0_12px_2px_rgba(255,210,122,0.9)]" : "scale-90 bg-ink/10 text-ink/30"}`}
                style={on ? { background: h.color ?? "var(--ice)" } : undefined}
                aria-hidden="true"
              >
                {h.number}
              </li>
            );
          })}
        </ul>
        <div className={`grid grid-cols-3 gap-2 transition-opacity duration-500 ${all ? "opacity-100" : "opacity-0"}`}>
          {tiles.map(([n, unit]) => (
            <p key={unit} className="rounded-2xl bg-warm py-1.5 text-center leading-tight">
              <b className="text-4xl font-black tabular-nums">{n}</b>
              <span className="ml-0.5 text-base font-bold">{unit}</span>
            </p>
          ))}
        </div>
        <p className={`text-center text-lg font-bold leading-snug transition-opacity duration-500 ${all ? "opacity-100" : "opacity-0"}`}>
          💡 {allClearLine(stats)}
          {stats.snowKg > 0 && <span className="block text-base font-normal text-ink-soft">どけた雪は、あわせて約{stats.snowKg.toLocaleString()}kg</span>}
        </p>
        {recap && (
          <div className={`shrink-0 rounded-2xl bg-warm px-3 py-2 transition-opacity duration-500 short:hidden ${all ? "opacity-100" : "opacity-0"}`}>
            <p className="line-clamp-3 text-sm leading-snug">「{recap}」</p>
          </div>
        )}
      </section>

      {/* 下: まとめへ・とじる */}
      <div className="relative mt-3 shrink-0 space-y-2">
        {onSummary && (
          <button type="button" onClick={onSummary} className="btn btn-lamp btn-big w-full text-xl" data-sound="tap">
            🎉 今日のまとめを見る
          </button>
        )}
        <button type="button" onClick={onClose} className={`btn w-full ${onSummary ? "min-h-12 text-base text-white underline" : "btn-lamp btn-big text-xl"}`} data-sound="tap">
          {onSummary ? "地図にもどる" : "みんな、おつかれさま！"}
        </button>
      </div>
    </div>
  );
}
