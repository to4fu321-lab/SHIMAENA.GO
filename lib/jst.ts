// 日本時間（JST, +09:00）の日付と時刻。サーバーは UTC で動くので、ここを通して扱う。

const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

function shifted(d: Date): Date {
  return new Date(d.getTime() + JST_OFFSET_MS);
}

/** YYYY-MM-DD（JST） */
export function jstDate(d: Date = new Date()): string {
  return shifted(d).toISOString().slice(0, 10);
}

/** 0 時からの分（JST） */
export function jstMinutes(d: Date = new Date()): number {
  const t = shifted(d);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
}

/** YYYY-MM-DDTHH:mm（JST、Open-Meteo の時刻と同じ形） */
export function jstHourMinute(d: Date = new Date()): string {
  return shifted(d).toISOString().slice(0, 16);
}

export function addDays(ymd: string, n: number): string {
  const t = new Date(`${ymd}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

const pad = (n: number) => String(n).padStart(2, "0");

export const clockText = (min: number) => `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;

/** 日付と「0 時からの分」から ISO（+09:00）を作る */
export function jstIso(ymd: string, minutes: number): string {
  return `${ymd}T${clockText(minutes)}:00+09:00`;
}
