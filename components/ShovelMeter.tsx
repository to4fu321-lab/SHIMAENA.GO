"use client";

// スコップカウンター（spec v1.31 スマートウォッチ）: 雪かきの「ザクッ」を、ポケットや腕のスマホの加速度センサーで数える。
// 時計の動きは Web からは読めないので、スマホのセンサーで。数えるだけ（得点には入れない）。
// - iPhone はセンサーの許可が要る（毎回タップ）。Android は一度オンにしたら次も自動。
// - 数えている間は画面を消さない（Wake Lock。画面が消えるとセンサーが止まるため）。
// - 1 回ごとに「ザクッ」、10 回ごとに振動、50 回ごとに「ひと息」（けがをしないための決まった文）。
import { useCallback, useEffect, useRef, useState } from "react";
import { play, vibrate } from "@/lib/sound/engine";
import { createGravityFilter, createStrokeDetector, pacePerMinute, restHint, type StrokeDetector } from "@/lib/watch/strokes";

type State = "unsupported" | "off" | "asking" | "on" | "denied";
const ON_KEY = "shimaena-strokes"; // "on": 次も自動で数える（許可が要らない端末だけ）

type MotionCtor = typeof DeviceMotionEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
const motionCtor = (): MotionCtor | undefined => (typeof DeviceMotionEvent === "undefined" ? undefined : (DeviceMotionEvent as MotionCtor));
const needsPermission = () => typeof motionCtor()?.requestPermission === "function";

export function strokesStorageKey(viewerId: string): string {
  return `solo-strokes-${viewerId}`;
}

type WakeLock = { release(): Promise<void> };
async function requestWakeLock(): Promise<WakeLock | null> {
  try {
    const wl = (navigator as { wakeLock?: { request(t: "screen"): Promise<WakeLock> } }).wakeLock;
    if (wl && document.visibilityState === "visible") return await wl.request("screen");
  } catch {
    /* 使えない端末 */
  }
  return null;
}

export default function ShovelMeter({
  storageKey,
  startedAt,
  onChange,
  label = "動きを数える",
}: {
  /** 回数を覚える鍵（開き直しても続きから。親が報告のあとに消す） */
  storageKey: string;
  /** ミッションの開始時刻。変わったら 0 から */
  startedAt: number;
  onChange?: (count: number) => void;
  label?: string;
}) {
  const [state, setState] = useState<State>("off");
  const [count, setCount] = useState(0);
  const [pace, setPace] = useState(0);
  const [hint, setHint] = useState<string>();
  const det = useRef<StrokeDetector>(createStrokeDetector());
  const lock = useRef<WakeLock | null>(null);
  const handler = useRef<((e: DeviceMotionEvent) => void) | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const remember = useCallback(
    (c: number) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ startedAt, count: c }));
      } catch {}
    },
    [storageKey, startedAt],
  );

  const stop = useCallback((forget: boolean) => {
    if (handler.current) window.removeEventListener("devicemotion", handler.current);
    handler.current = null;
    void lock.current?.release().catch(() => undefined);
    lock.current = null;
    if (forget) {
      try {
        localStorage.setItem(ON_KEY, "off");
      } catch {}
      setState("off");
    }
  }, []);

  /** auto: 前にオンにしていたので自動で（許可がもらえなければ黙ってオフのまま。タップなら「許可がもらえませんでした」） */
  const start = useCallback(async (auto = false) => {
    const ctor = motionCtor();
    if (!ctor) return;
    setState("asking");
    try {
      if (needsPermission()) {
        const r = await ctor.requestPermission!();
        if (r !== "granted") {
          setState(auto ? "off" : "denied");
          return;
        }
      }
    } catch {
      setState(auto ? "off" : "denied");
      return;
    }
    const gravity = createGravityFilter();
    const h = (e: DeviceMotionEvent) => {
      const d = det.current;
      const a = e.acceleration;
      let v: [number, number, number];
      if (a && a.x !== null && a.y !== null && a.z !== null) v = [a.x, a.y, a.z];
      else {
        const g = e.accelerationIncludingGravity;
        if (!g || g.x === null || g.y === null || g.z === null) return;
        v = gravity(g.x, g.y, g.z);
      }
      const now = performance.now();
      if (!d.feed(now, v[0], v[1], v[2])) return;
      const c = d.count;
      setCount(c);
      setPace(pacePerMinute(d.times, now));
      remember(c);
      onChangeRef.current?.(c);
      play("dig", { gain: 0.6 });
      if (c % 10 === 0) vibrate(20);
      const rest = restHint(c);
      if (rest) {
        play("countPop");
        setHint(rest);
        setTimeout(() => setHint((cur) => (cur === rest ? undefined : cur)), 8000);
      }
    };
    handler.current = h;
    window.addEventListener("devicemotion", h);
    lock.current = await requestWakeLock();
    try {
      localStorage.setItem(ON_KEY, "on");
    } catch {}
    setState("on");
  }, [remember]);

  // 画面が出たら: 使える端末か、覚えていた回数（同じミッションの続き）、前にオンにしていたら自動で
  useEffect(() => {
    const t = setTimeout(() => {
      if (!motionCtor()) {
        setState("unsupported");
        return;
      }
      let saved = 0;
      try {
        const v = JSON.parse(localStorage.getItem(storageKey) ?? "null") as { startedAt?: number; count?: number } | null;
        if (v && v.startedAt === startedAt && typeof v.count === "number") saved = v.count;
      } catch {}
      det.current = createStrokeDetector({}, saved);
      setCount(saved);
      setPace(0);
      onChangeRef.current?.(saved);
      let auto = false;
      try {
        auto = localStorage.getItem(ON_KEY) === "on";
      } catch {}
      if (auto) void start(true);
    }, 0);
    return () => {
      clearTimeout(t);
      stop(false);
    };
  }, [storageKey, startedAt, start, stop]);

  // 裏から戻ったら画面を消さない約束を取り直す（Wake Lock は裏に回ると外れる）
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible" && handler.current) void requestWakeLock().then((l) => (lock.current = l));
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // 1 分あたりの目安は、止まっていると古いままなので数秒ごとに更新
  useEffect(() => {
    if (state !== "on") return;
    const t = setInterval(() => setPace(pacePerMinute(det.current.times, performance.now())), 5000);
    return () => clearInterval(t);
  }, [state]);

  if (state === "unsupported") return null;
  const on = state === "on";
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-ice-soft px-3 py-1.5 ring-1 ring-ice short:py-1" aria-live="polite">
      <span className="text-2xl leading-none" aria-hidden="true">⛏</span>
      <div className="min-w-0 flex-1 leading-tight">
        {on ? (
          <>
            <b className="text-xl tabular-nums">{count}</b>
            <span className="text-sm font-bold">回</span>
            {pace > 0 && <span className="ml-2 text-sm font-bold text-ink-soft">1分に{pace}回</span>}
            <span className={`block truncate text-xs text-ink-soft ${hint ? "" : "short:hidden"}`}>{hint ?? "ポケットか腕に入れたまま数えます（画面はつけたまま）"}</span>
          </>
        ) : (
          <>
            <b className="text-base">{label}</b>
            <span className={`block truncate text-xs text-ink-soft ${state === "off" ? "short:hidden" : ""}`}>
              {state === "denied" ? "センサーの許可がもらえませんでした（設定で許可できます）" : state === "asking" ? "センサーの許可をもらっています…" : "スマホのセンサーで「ザクッ」を数える"}
            </span>
          </>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={state === "asking"}
        onClick={() => (on ? stop(true) : void start(false))}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? "bg-lamp" : "bg-ink/25"}`}
      >
        <span className={`absolute top-1 size-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} />
      </button>
    </div>
  );
}
