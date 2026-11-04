// 天気: Open-Meteo（無料・キー不要）。前夜 21:00 に「翌朝 6:00 までの降雪量」を見て、点呼をするか決める（spec 2）。
import { jstDate, jstHourMinute, addDays } from "./jst";
import type { LatLng } from "./types";

/** 点呼をする基準（翌朝 6:00 までに 5cm 以上） */
export const SNOW_THRESHOLD_CM = 5;

export interface HourlySnow {
  time: string[]; // "2026-12-13T21:00" のような JST の時刻
  snowfall: number[]; // cm
  /** 気温（℃）と風（m/s）。安全のひとこと用（spec v1.6）。古い答えにはない */
  temperature_2m?: number[];
  wind_speed_10m?: number[];
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

export async function fetchHourlySnow(center: LatLng, fetchFn: typeof fetch = fetch): Promise<HourlySnow> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(center[0]));
  url.searchParams.set("longitude", String(center[1]));
  url.searchParams.set("hourly", "snowfall,temperature_2m,wind_speed_10m");
  url.searchParams.set("wind_speed_unit", "ms");
  url.searchParams.set("timezone", "Asia/Tokyo");
  url.searchParams.set("forecast_days", "2");
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
  };
}
