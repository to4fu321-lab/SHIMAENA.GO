import { describe, expect, it } from "vitest";
import { agoText, alreadyAlerted, ALERT_DAILY_CAP, HAZARDS, pickRecipients, type RoadReport } from "./hazards";
import type { LatLng } from "../types";

const here: LatLng = [43.05, 141.35];
const north = (m: number): LatLng => [here[0] + m / 111320, here[1]];
const report = (o: Partial<RoadReport> = {}): RoadReport => ({
  id: "rd-1",
  participantId: "h1",
  hazard: "ice",
  location: here,
  at: "2026-12-14T00:00:00.000Z",
  date: "2026-12-14",
  ...o,
});
const person = (id: string, m: number, o: Partial<{ enabled: boolean; sentToday: number; lineUserId?: string }> = {}) => ({
  participantId: id,
  lineUserId: `U-${id}`,
  home: north(m),
  enabled: true,
  sentToday: 0,
  ...o,
});

describe("道の危険の報告（11/4 本人の指示）", () => {
  it("知らせたいことは5つ", () => {
    expect(HAZARDS.map((h) => h.id)).toEqual(["no_plow", "narrow", "no_sidewalk", "slush", "ice"]);
  });

  it("知らせるのは、オンにした・家が 300m 以内・報告した本人以外・今日3回未満の人。近い順", () => {
    const to = pickRecipients(report(), [
      person("h1", 10), // 本人
      person("h2", 250),
      person("h3", 100),
      person("h4", 400), // 遠い
      person("h5", 50, { enabled: false }), // オフ
      person("h6", 50, { sentToday: ALERT_DAILY_CAP }), // 今日はもう3回
      person("h7", 50, { lineUserId: undefined }), // LINE なし
    ]);
    expect(to.map((t) => t.participantId)).toEqual(["h3", "h2"]);
    expect(to[0].distance).toBe(100);
  });

  it("2時間以内・50m 以内の同じ種類がもう知らされていれば、まとめて1回", () => {
    const first = report({ id: "rd-0", notifiedAt: "2026-12-14T00:00:00.000Z" });
    expect(alreadyAlerted(report({ location: north(30), at: "2026-12-14T01:00:00.000Z" }), [first])).toBe(true);
    expect(alreadyAlerted(report({ location: north(80), at: "2026-12-14T01:00:00.000Z" }), [first])).toBe(false); // 離れている
    expect(alreadyAlerted(report({ hazard: "slush", at: "2026-12-14T01:00:00.000Z" }), [first])).toBe(false); // 種類がちがう
    expect(alreadyAlerted(report({ at: "2026-12-14T03:00:00.000Z" }), [first])).toBe(false); // 時間がたった
    expect(alreadyAlerted(report(), [{ ...first, notifiedAt: undefined }])).toBe(false); // まだ知らせていない（夜）
  });

  it("何分前", () => {
    const now = new Date("2026-12-14T02:00:00.000Z");
    expect(agoText("2026-12-14T01:48:00.000Z", now)).toBe("12分前");
    expect(agoText("2026-12-13T23:00:00.000Z", now)).toBe("3時間前");
  });
});
