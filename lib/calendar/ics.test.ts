import { describe, expect, it } from "vitest";
import { buildIcs, fold, googleCalendarUrl, slotEvent } from "./ics";

describe("📅 予定に入れる（spec v1.39）", () => {
  const ev = slotEvent({ date: "2026-12-14", when: "am", teamName: "サルビア", appUrl: "https://example.test/team?tab=time", area: "しらかばエリア" });

  it("帯の集まる時刻（日本時間）から 30 分の予定になる", () => {
    expect(ev.start).toBe("2026-12-13T22:00:00.000Z"); // 12/14 7:00 JST
    expect(ev.end).toBe("2026-12-13T22:30:00.000Z");
    expect(slotEvent({ date: "2026-12-14", when: "pm", appUrl: "u", area: "a" }).start).toBe("2026-12-14T07:30:00.000Z"); // 16:30 JST
    expect(ev.title).toBe("シマエナGO 雪かき（サルビア）");
  });

  it(".ics はカレンダーの決まりどおり（UTC の時刻・15分前の知らせ・改行は CRLF）", () => {
    const ics = buildIcs(ev, new Date("2026-12-13T12:00:00Z"));
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20261213T220000Z");
    expect(ics).toContain("DTEND:20261213T223000Z");
    expect(ics).toContain("DTSTAMP:20261213T120000Z");
    expect(ics).toContain("TRIGGER:-PT15M");
    expect(ics).toContain("LOCATION:しらかばエリア");
    expect(ics).not.toMatch(/[^\r]\n/); // LF だけの改行はない
    // 1行 75 バイトまで
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });

  it("長い行は文字の途中で切らずに折り返し、つなぐと元に戻る", () => {
    const long = `DESCRIPTION:${"雪かき".repeat(40)}`;
    const folded = fold(long);
    expect(folded.split("\r\n ").join("")).toBe(long);
  });

  it("説明の改行・カンマはエスケープする", () => {
    const ics = buildIcs({ ...ev, details: "a,b;c\nd" });
    expect(ics).toContain("DESCRIPTION:a\\,b\;c\\nd");
  });

  it("Google カレンダーのリンクは予定作成の画面で、時刻は UTC", () => {
    const u = new URL(googleCalendarUrl(ev));
    expect(u.hostname).toBe("calendar.google.com");
    expect(u.searchParams.get("action")).toBe("TEMPLATE");
    expect(u.searchParams.get("dates")).toBe("20261213T220000Z/20261213T223000Z");
    expect(u.searchParams.get("text")).toBe("シマエナGO 雪かき（サルビア）");
  });

  it("予定の中身に、家の名前・人の名前は入らない（日付・帯・チーム名・エリアだけ）", () => {
    const text = `${ev.title}${ev.details}${ev.location}`;
    expect(text).not.toMatch(/さん|様|丁目|番地/);
  });
});
