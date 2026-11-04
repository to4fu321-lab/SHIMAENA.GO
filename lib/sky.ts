// ホームの背景（空）: いまの天気と時間で変える。
// 天気は Open-Meteo の「いま」（キー不要）。取れないときは今朝の予報（積雪 cm）で決める。
import type { LatLng } from "./types";

export type TimeOfDay = "dawn" | "day" | "dusk" | "night";
export type Weather = "snow" | "cloudy" | "clear";

export interface Sky {
  time: TimeOfDay;
  weather: Weather;
}

/** 0 時からの分（JST）→ 朝・昼・夕方・夜 */
export function timeOfDay(minutes: number): TimeOfDay {
  const h = minutes / 60;
  if (h >= 5 && h < 8) return "dawn";
  if (h >= 8 && h < 16) return "day";
  if (h >= 16 && h < 18) return "dusk";
  return "night";
}

/** Open-Meteo の天気コード（WMO）→ 雪・くもり・晴れ。雨やみぞれは「くもり」として描く */
export function weatherOf(code: number | undefined, fallbackSnowCm = 0): Weather {
  if (code === undefined) return fallbackSnowCm > 0 ? "snow" : "cloudy";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code <= 1) return "clear";
  return "cloudy";
}

const TIMES: TimeOfDay[] = ["dawn", "day", "dusk", "night"];
const WEATHERS: Weather[] = ["snow", "cloudy", "clear"];

/** デモ用の上書き（?sky=night-snow など）。正しくなければ undefined */
export function parseSkyParam(v: string | undefined): Sky | undefined {
  if (!v) return undefined;
  const [t, w] = v.split("-");
  if (!TIMES.includes(t as TimeOfDay) || !WEATHERS.includes(w as Weather)) return undefined;
  return { time: t as TimeOfDay, weather: w as Weather };
}

export interface CurrentWeather {
  code?: number;
  tempC?: number;
  windMs?: number;
}

/** いまの天気コード。15分ごとに取り直す。失敗したら undefined（画面は止めない） */
export async function currentWeatherCode(center: LatLng): Promise<number | undefined> {
  return (await currentWeather(center)).code;
}

/** いまの天気・気温・風（休みのひとこと用）。15分ごとに取り直す。失敗したら空 */
export async function currentWeather(center: LatLng): Promise<CurrentWeather> {
  try {
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.searchParams.set("latitude", String(center[0]));
    url.searchParams.set("longitude", String(center[1]));
    url.searchParams.set("current", "weather_code,temperature_2m,wind_speed_10m");
    url.searchParams.set("wind_speed_unit", "ms");
    url.searchParams.set("timezone", "Asia/Tokyo");
    const res = await fetch(url, { next: { revalidate: 900 }, signal: AbortSignal.timeout(2500) });
    if (!res.ok) return {};
    const json = (await res.json()) as { current?: { weather_code?: number; temperature_2m?: number; wind_speed_10m?: number } };
    const c = json.current ?? {};
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
    return { code: num(c.weather_code), tempC: num(c.temperature_2m), windMs: num(c.wind_speed_10m) };
  } catch {
    return {};
  }
}

/** 空の色（上→下）。文字は空の上に直接のせないので、夜でも読みやすさは変わらない */
export function skyColors({ time, weather }: Sky): [string, string] {
  const table: Record<TimeOfDay, Record<Weather, [string, string]>> = {
    dawn: { clear: ["#f7c9a8", "#fbe9dc"], cloudy: ["#d9cfd6", "#eee8ea"], snow: ["#cfd3df", "#eceef4"] },
    day: { clear: ["#8fc3ea", "#e3f1fa"], cloudy: ["#c3cfd9", "#e9eef2"], snow: ["#cdd9e3", "#eef3f7"] },
    dusk: { clear: ["#e99a72", "#f6d6bf"], cloudy: ["#b9a9b4", "#e0d6d9"], snow: ["#a9a5bd", "#dcdbe6"] },
    night: { clear: ["#1d2f4a", "#3a5677"], cloudy: ["#2a3646", "#4a5869"], snow: ["#2b3a52", "#51627a"] },
  };
  return table[time][weather];
}
