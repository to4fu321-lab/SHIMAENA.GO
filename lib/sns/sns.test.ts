import { describe, expect, it } from "vitest";
import { svgToPng } from "../cards/png";
import type { MorningRecord } from "../morning/flow";
import { TOWN_ROSTER } from "../morning/roster";
import { DEMO_MORNING } from "../morning/sample";
import { buildPublicStats } from "../public/stats";
import type { SoloLog } from "../types";
import { renderShareSvg, SHARE_SIZE, shareCardData } from "./cards";
import { mockShareText, SHARE_TEXT_MAX, type ShareKind } from "./text";

const record = (): MorningRecord => ({ morning: structuredClone(DEMO_MORNING), answers: [], messages: [], briefing: "", clockMin: 0, log: [] });
const solo = (id: string, participantId: string, kind: SoloLog["kind"], date = DEMO_MORNING.rollcall.date): SoloLog => ({
  id,
  participantId,
  date,
  kind,
  onsite: kind !== "check_area",
  feathers: 5,
  cellKey: "1,2",
  at: `${date}T07:30:00+09:00`,
});

function stats() {
  const r = record();
  return buildPublicStats({
    record: r,
    roster: TOWN_ROSTER,
    today: r.morning.rollcall.date,
    soloWeek: [solo("a", "h1", "patrol"), solo("b", "r2", "own_house"), solo("c", "h1", "bonus_first"), solo("d", "h99", "check_area")],
    weekRecords: [r],
    cheers: 4,
  });
}

describe("公開の集計（個人情報なし）", () => {
  it("数字は集計だけ。名前・緯度経度・マスのキー・拠点番号は入らない", () => {
    const st = stats();
    expect(st.housesTotal).toBeGreaterThan(0);
    expect(st.thawPct).toBe(Math.round((st.housesDone / st.housesTotal) * 100));
    expect(st.soloPeople).toBe(3); // ボーナスの行は人数にも件数にも入れない
    expect(st.todayMissions).toBe(st.housesDone + 3);
    expect(st.cheers).toBe(4);
    const json = JSON.stringify(st);
    for (const p of TOWN_ROSTER.participants) {
      expect(json).not.toContain(p.nickname);
      expect(json).not.toContain(String(p.location[0]));
      expect(json).not.toContain(String(p.location[1]));
    }
    expect(json).not.toContain("cellKey");
    expect(json).not.toContain("1,2");
    expect(json).not.toMatch(/拠点\s?\d/);
  });

  it("投稿文は 115 字以内で、#シマエナGO が入る", () => {
    const st = stats();
    for (const kind of ["today", "town", "recruit", "me"] as ShareKind[]) {
      const t = mockShareText(kind, st, { todayFeathers: 13, streak: 3, todayActs: 2 });
      expect([...t].length).toBeLessThanOrEqual(SHARE_TEXT_MAX);
      expect(t).toContain("#シマエナGO");
    }
    expect(mockShareText("today", st)).toContain(`${st.todayPeople}羽のシマエナ`);
  });
});

describe("SNS シェアカード", () => {
  it("4種×3サイズの PNG が作れる。町のカードに名前は載らない", async () => {
    const st = stats();
    for (const kind of ["today", "town", "recruit", "me"] as ShareKind[]) {
      for (const f of ["square", "story", "og"] as const) {
        const svg = renderShareSvg(shareCardData(kind, st, "example.com/public/town", { nickname: "テストさん", todayFeathers: 1, streak: 1, todayActs: 1 }), f);
        const [w, h] = SHARE_SIZE[f];
        expect(svg).toContain(`viewBox="0 0 ${w} ${h}"`);
        if (kind !== "me") for (const p of TOWN_ROSTER.participants) expect(svg).not.toContain(p.nickname);
        if (kind === "town" && f === "square") {
          const png = await svgToPng(svg, { width: w });
          expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
          // 幅（IHDR の 16〜19 バイト目）
          expect(new DataView(png.buffer, png.byteOffset).getUint32(16)).toBe(w);
        }
      }
    }
  }, 30000);

  it("募集カード: あと1人の家があれば「あと1人で雪解け！」", () => {
    const st = { ...stats(), shortHouses: 2, shortMissingMin: 1 };
    expect(shareCardData("recruit", st, "x").headline).toBe("あと1人で雪解け！");
    expect(shareCardData("recruit", { ...st, shortHouses: 0 }, "x").headline).toBe("今日の町を一緒に救おう");
  });
});
