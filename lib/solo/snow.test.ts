// 自宅の雪かき（ソロ）のどけた雪（spec v1.8）: 手がかりがある日だけ kg を出す。カードにも載る。「0kg」は出さない
import { beforeEach, describe, expect, it } from "vitest";
import { renderCardBackSvg, renderCardSvg, type CardArt } from "../cards/svg";
import { DEMO_DATE } from "../morning/flow";
import { announce } from "../morning/ops";
import { memoryRepo } from "../repo";
import { snowKgOf, soloSnow } from "../snow-estimate";
import { completeSolo } from "./ops";

describe("ソロのどけた雪の計算", () => {
  const rc = { date: "2026-12-14", forecastCm: 12, depthCm: 30, tempMinC: -3 };
  it("雪の朝（同じ日）は予報で、写真の深さが読めればそれで。面積は登録の範囲（なければ玄関前）", () => {
    expect(soloSnow({ today: "2026-12-14", rollcall: rc })?.snowKg).toBe(snowKgOf(12, "entrance"));
    const withPhoto = soloSnow({ today: "2026-12-14", rollcall: rc, photo: { min: 15, max: 25, confidence: "mid" }, snowType: "wet", area: "garage" });
    expect(withPhoto?.snowKg).toBe(snowKgOf(20, "garage", "wet"));
    expect(withPhoto?.snowKgBasis).toContain("写真から");
  });
  it("雪の朝ではない日は、写真の深さが読めたときだけ。手がかりがなければ出さない（数字を作らない）", () => {
    expect(soloSnow({ today: "2026-12-20", rollcall: rc })).toBeUndefined();
    expect(soloSnow({ today: "2026-12-20", rollcall: rc, photo: { min: 8, max: 12, confidence: "low" } })).toBeUndefined();
    expect(soloSnow({ today: "2026-12-20", rollcall: rc, photo: { min: 8, max: 12, confidence: "high" } })?.snowKg).toBe(snowKgOf(10, "entrance"));
  });
});

describe("ソロの完了とカード", () => {
  beforeEach(() => {
    for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive", "__shimaenaSoloScores", "__shimaenaPhotoSeen"]) delete (globalThis as Record<string, unknown>)[k];
  });
  const now = new Date("2026-11-03T03:00:00Z"); // 昼

  it("自宅の雪かき: 雪の朝なら kg が出て、はじめてのカードの消印も kg になる", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    const r = await completeSolo("h3", "own_house", { now });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.summary.snowKg).toBe(snowKgOf(12, "entrance"));
    expect(r.summary.snowKgComparison).toBeTruthy();
    expect(r.summary.reveal?.stampText).toBe(`${r.summary.snowKg}kg`);
    const stored = await memoryRepo.getCard(r.summary.card!.id);
    expect(stored!.svg).toContain(`${r.summary.snowKg}kg`);
    expect(stored!.backSvg).toContain("どけた雪 およそ");
  });
  it("見回りなど自宅の雪かき以外は kg を出さない", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    const r = await completeSolo("h3", "patrol", { now });
    expect(r.ok && r.summary.snowKg).toBeFalsy();
  });
  it("kg がないソロのカードに「0kg」は出さない", () => {
    const art: CardArt = { style: "kawaii", designName: "はじめてのソロ出動", designNameEn: "First", rarityLabel: "ひとり", stars: 1, members: [{ name: "ゆき" }], date: "2026-12-14", townName: "しらかばエリア", snowKg: 0, snowKgComparison: "ソロ出動", serial: 1, issuedCount: 1, stampText: "ソロ" };
    expect(renderCardSvg(art)).not.toContain("0kg");
    expect(renderCardBackSvg(art, { thanks: "x", subtasks: [] })).not.toContain("0kg");
  });
});
