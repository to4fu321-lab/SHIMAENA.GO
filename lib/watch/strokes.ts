// スコップカウンター（spec v1.31）: 端末の加速度センサー（DeviceMotion）から、雪かきの「ザクッ」を数える。
// 時計そのものの動きは Web からは読めないので、ポケットや腕のスマホのセンサーで数える（数えるだけ。得点には入れない）。
// ここは純粋な計算だけ（画面やセンサーの読み取りは components/ShovelMeter.tsx）。

export interface StrokeOptions {
  /** この加速度（m/s²、重力を除く）を超えたら「ザクッ」の候補 */
  threshold?: number;
  /** ここまで下がったら次の「ザクッ」を受け付ける（ひとつの動きを2回数えないため） */
  release?: number;
  /** 前の「ザクッ」からこのミリ秒は数えない（人の雪かきは 1 回 0.5〜2 秒） */
  minGapMs?: number;
}

const DEFAULTS: Required<StrokeOptions> = { threshold: 9, release: 4, minGapMs: 420 };

export interface StrokeDetector {
  /** 1 サンプル入れる。「ザクッ」と数えたら true */
  feed(t: number, ax: number, ay: number, az: number): boolean;
  /** 数えた回数 */
  readonly count: number;
  /** 数えた時刻（新しいものから最大 120 個） */
  readonly times: readonly number[];
  reset(count?: number): void;
}

export function magnitude(ax: number, ay: number, az: number): number {
  return Math.sqrt(ax * ax + ay * ay + az * az);
}

/** 加速度の山を 1 回ずつ数える（しきい値 → 戻り → しきい値、で 1 回） */
export function createStrokeDetector(opts: StrokeOptions = {}, start = 0): StrokeDetector {
  const o = { ...DEFAULTS, ...opts };
  let count = start;
  let armed = true;
  let lastAt = -Infinity;
  const times: number[] = [];
  return {
    feed(t, ax, ay, az) {
      const m = magnitude(ax, ay, az);
      if (!Number.isFinite(m)) return false;
      if (armed && m >= o.threshold && t - lastAt >= o.minGapMs) {
        armed = false;
        lastAt = t;
        count++;
        times.unshift(t);
        if (times.length > 120) times.length = 120;
        return true;
      }
      if (!armed && m <= o.release) armed = true;
      return false;
    },
    get count() {
      return count;
    },
    get times() {
      return times;
    },
    reset(c = 0) {
      count = c;
      armed = true;
      lastAt = -Infinity;
      times.length = 0;
    },
  };
}

/** 直近 window ミリ秒の回数から「1 分あたり」の目安（数が少ないときは 0） */
export function pacePerMinute(times: readonly number[], now: number, windowMs = 60_000): number {
  const n = times.filter((t) => now - t <= windowMs && now - t >= 0).length;
  if (n < 2) return 0;
  return Math.round((n * 60_000) / windowMs);
}

/**
 * 重力を除く加速度がない端末のために、重力を低域フィルタで引く。
 * （DeviceMotion の acceleration が null のとき、accelerationIncludingGravity から使う）
 */
export function createGravityFilter(alpha = 0.85) {
  let g: [number, number, number] | undefined;
  return (ax: number, ay: number, az: number): [number, number, number] => {
    if (!g) g = [ax, ay, az];
    else g = [alpha * g[0] + (1 - alpha) * ax, alpha * g[1] + (1 - alpha) * ay, alpha * g[2] + (1 - alpha) * az];
    return [ax - g[0], ay - g[1], az - g[2]];
  };
}

/** 50 回ごとに「ひと息」（けがをしないための決まった文。体調の判断はしない） */
export const REST_EVERY = 50;
export function restHint(count: number): string | undefined {
  if (count > 0 && count % REST_EVERY === 0) return `${count}回！ ひと息入れて、腰をのばそう。`;
  return undefined;
}

/** 記録に残す回数（0〜9999 の整数。数えていないときは undefined） */
export function cleanStrokes(v: unknown): number | undefined {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(9999, Math.floor(n));
}
