// 📅 予定に入れる（spec v1.41 ①）。.ics（iPhone の標準カレンダー・Outlook・Google など）と、Google カレンダーの予定作成のリンク。
// 家の名前・住所・人の名前は入れない。アプリはカレンダーを読まない・書きかえない。
import { MEET_MINUTES, slotOf } from "./slots";
import type { HelperWhen } from "../types";

export interface CalEvent {
  uid: string;
  /** 始まりと終わり（UTC の ISO） */
  start: string;
  end: string;
  title: string;
  details: string;
  location: string;
  url: string;
}

/** その日（JST の YYYY-MM-DD）の帯の予定。集まる時刻から 30 分 */
export function slotEvent(opts: { date: string; when: HelperWhen; teamName?: string; appUrl: string; area: string }): CalEvent {
  const s = slotOf(opts.when);
  const start = new Date(`${opts.date}T${s.meet}:00+09:00`);
  const end = new Date(start.getTime() + MEET_MINUTES * 60_000);
  return {
    uid: `shimaena-${opts.date}-${opts.when}${opts.teamName ? `-${encodeURIComponent(opts.teamName)}` : ""}@shimaena-go`,
    start: start.toISOString(),
    end: end.toISOString(),
    title: `シマエナGO 雪かき${opts.teamName ? `（${opts.teamName}）` : ""}`,
    details: `${s.label}の雪かき。チームで集まる時間です。行き先はアプリの地図で。\n${opts.appUrl}`,
    location: opts.area,
    url: opts.appUrl,
  };
}

/** 20261108T220000Z の形 */
function utcStamp(iso: string): string {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** iCalendar の文字の決まり（\ ; , と改行） */
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** 1行 75 バイトまで（日本語は文字の途中で切らない）。続きの行は空白で始める */
export function fold(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + n > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function buildIcs(ev: CalEvent, now: Date = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SHIMAENA GO//JA",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${ev.uid}`,
    `DTSTAMP:${utcStamp(now.toISOString())}`,
    `DTSTART:${utcStamp(ev.start)}`,
    `DTEND:${utcStamp(ev.end)}`,
    `SUMMARY:${esc(ev.title)}`,
    `DESCRIPTION:${esc(ev.details)}`,
    `LOCATION:${esc(ev.location)}`,
    `URL:${ev.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${esc(ev.title)}`,
    "TRIGGER:-PT15M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** Google カレンダーの「予定を作成」画面のリンク（ログインしている Google のカレンダーに、本人が保存する） */
export function googleCalendarUrl(ev: CalEvent): string {
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${utcStamp(ev.start)}/${utcStamp(ev.end)}`,
    details: ev.details,
    location: ev.location,
    ctz: "Asia/Tokyo",
  });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}
