// 天気: Open-Meteo（無料・キー不要）。前夜 21:00 に「翌朝 6:00 までの降雪量」を見て、点呼をするか決める（spec 2）。
import { jstDate, jstHourMinute, addDays } from "./jst";
import type { LatLng } from "./types";

/** 雪かき応援を自動で知らせる基準（spec v1.20: きのう 6:00 から今朝 6:00 までに 10cm 以上積もったら） */
export const SNOW_THRESHOLD_CM = 10;

export interface HourlySnow {
  time: string[]; // "2026-12-13T21:00" のような JST の時刻
  snowfall: number[]; // cm
  /** 気温（℃）と風（m/s）。安全のひとこと用（spec v1.6）。古い答えにはない */
  temperature_2m?: number[];
  wind_speed_10m?: number[];
  /** 積雪深（m、モデルの解析値。spec v1.8 雪量の推定の目安） */
  snow_depth?: number[];
}

/** from 以上 until 未満の時間帯の最小値・最大値（値がなければ undefined） */
function pick(hourly: HourlySnow, values: number[] | undefined, from: string, until: string, f: (...x: number[]) => number): number | undefined {
  if (!values) return undefined;
  const xs = hourly.time.flatMap((t, i) => (t >= from && t < until && typeof values[i] === "number" ? [values[i]] : []));
  return xs.length > 0 ? Math.round(f(...xs) * 10) / 10 : undefined;
}

/** from 以上 until 未満の時間帯の降雪量を足す */
export function sumSnowfall(hourly: HourlySnow, from: string, until: string): number {
  let sum = 0;
  hourly.time.forEach((t, i) => {
    if (t >= from && t < until) sum += hourly.snowfall[i] ?? 0;
  });
  return Math.round(sum * 10) / 10;
}

export async function fetchHourlySnow(center: LatLng, fetchFn: typeof fetch = fetch, opts: { pastDays?: number } = {}): Promise<HourlySnow> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(center[0]));
  url.searchParams.set("longitude", String(center[1]));
  url.searchParams.set("hourly", "snowfall,temperature_2m,wind_speed_10m,snow_depth");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("timezone", "Asia/Tokyo");
  url.searchParams.set("forecast_days", "2");
  if (opts.pastDays) url.searchParams.set("past_days", String(opts.pastDays)); // 積もった量（きのう6時から今朝6時まで）を見るとき
  const res = await fetchFn(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo が ${res.status} を返しました`);
  const json = (await res.json()) as { hourly?: HourlySnow };
  if (!json.hourly?.time || !json.hourly.snowfall) throw new Error("Open-Meteo の答えに hourly.snowfall がありません");
  return json.hourly;
}

export interface SnowForecast {
  snowfallCm: number;
  from: string;
  until: string;
  /** 点呼の対象になる朝の日付（YYYY-MM-DD） */
  morningDate: string;
  /** 朝 9:00 までの最低気温（℃）と最大の風（m/s）。安全のひとこと用 */
  tempMinC?: number;
  windMaxMs?: number;
  /** 朝の積雪深（cm、モデルの解析値）。写真の深さの推定と突き合わせる目安 */
  depthCm?: number;
}

/** いまから「次の朝 6:00」までの降雪量。夜に呼ぶ想定（朝 6 時前に呼ばれたら今朝が対象） */
export async function forecastSnowUntilMorning(
  center: LatLng,
  now: Date = new Date(),
  fetchFn: typeof fetch = fetch,
): Promise<SnowForecast> {
  const from = jstHourMinute(now);
  const today = jstDate(now);
  const morningDate = from < `${today}T06:00` ? today : addDays(today, 1);
  const until = `${morningDate}T06:00`;
  const hourly = await fetchHourlySnow(center, fetchFn);
  const workUntil = `${morningDate}T09:00`; // 雪かきをする朝の時間まで
  return {
    snowfallCm: sumSnowfall(hourly, from, until),
    from,
    until,
    morningDate,
    tempMinC: pick(hourly, hourly.temperature_2m, from, workUntil, Math.min),
    windMaxMs: pick(hourly, hourly.wind_speed_10m, from, workUntil, Math.max),
    depthCm: depthAt(hourly, until),
  };
}

/** その時刻の積雪深（cm）。値がなければ undefined */
export function depthAt(hourly: HourlySnow, at: string): number | undefined {
  const i = hourly.time.indexOf(at);
  const m = i >= 0 ? hourly.snow_depth?.[i] : undefined;
  return typeof m === "number" && m >= 0 ? Math.round(m * 100) : undefined;
}
