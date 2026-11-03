import { describe, expect, it } from "vitest";
import { estimateSnowKg, mockCardText, snowComparison } from "../claude/card";
import { memoryRepo } from "../repo";
import { TEAMS } from "../teams";
import { DEMO_DATE, fillAnswers } from "../morning/flow";
import { announce, completeWithPhoto, plan, ring } from "../morning/ops";
import { loadRoster } from "../morning/roster";
import { loadMorning, saveMorning } from "../morning/store";
import { composeForExport } from "./export";
import { cardImageMessages } from "./issue";
import { svgToPng } from "./png";
import { decideRarity } from "./rarity";
import { dateLabel, escapeXml, renderCardBackSvg, renderCardSvg, wrap, type CardArt } from "./svg";

const art = (over: Partial<CardArt> = {}): CardArt => ({
  style: "kawaii",
  designName: "玄関までの三十歩",
  designNameEn: "Thirty Steps to the Door",
  rarityLabel: "朝の群れ",
  stars: 1,
  members: [
    { name: "田中", teamId: "salvia" },
    { name: "鈴木", teamId: "marigold" },
    { name: "ゆうき（小5）", teamId: "salvia" },
  ],
  date: "2026-12-14",
  townName: "しらかば町内",
  snowKg: 720,
  snowKgComparison: "軽トラ1台分",
  serial: 7,
  issuedCount: 32,
  ...over,
});

describe("レア判定", () => {
  const base = { completedAt: "2026-12-14T08:10:00+09:00", forecastCm: 12, teamIds: ["salvia" as const], streakDays: 1 };
  it("ふつうの朝は基本のかわいいタッチ ★", () => {
    expect(decideRarity(base)).toEqual({ style: "kawaii", label: "朝の群れ", stars: 1 });
  });
  it("7:30 までに完了なら 80s レトロウェーブ ★★", () => {
    expect(decideRarity({ ...base, completedAt: "2026-12-14T07:20:00+09:00" }).style).toBe("retrowave");
  });
  it("20cm 以上なら切り絵、2チームなら湾岸ポップ、5日連続ならドット絵（この順でめずらしい）", () => {
    expect(decideRarity({ ...base, forecastCm: 25 }).style).toBe("kirie");
    expect(decideRarity({ ...base, forecastCm: 25, teamIds: ["salvia", "lupinus"] }).style).toBe("eijin");
    expect(decideRarity({ ...base, forecastCm: 25, teamIds: ["salvia", "lupinus"], streakDays: 5 }).style).toBe("pixel");
    expect(decideRarity({ ...base, streakDays: 5 }).stars).toBe(3);
  });
});

describe("カードの SVG", () => {
  it("来た人の数だけシマエナガが並び、耳あてはその人のチーム色", () => {
    const svg = renderCardSvg(art());
    const blue = TEAMS.find((t) => t.id === "salvia")!.color;
    const orange = TEAMS.find((t) => t.id === "marigold")!.color;
    // 1羽につき耳あて2つ
    expect(svg.split(`fill="${blue}"`).length - 1).toBe(4);
    expect(svg.split(`fill="${orange}"`).length - 1).toBe(2);
    expect(svg).toContain("玄関までの三十歩");
    expect(svg).toContain("No.007/32");
    expect(svg).toContain("720kg");
    expect(svg).toContain("2026.12.14 MON");
    expect(svg).toContain("サルビア × マリーゴールド");
  });
  it("5つのタッチが全部描け、レアだけホログラムが入る", () => {
    for (const style of ["kawaii", "retrowave", "kirie", "pixel", "eijin"] as const) {
      const svg = renderCardSvg(art({ style, stars: style === "kawaii" ? 1 : 3 }));
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg).toContain("</svg>");
      expect(svg.includes("holoGrad")).toBe(true);
      expect(svg.includes("animateTransform")).toBe(style !== "kawaii");
    }
    expect(renderCardSvg(art({ stars: 2 }))).toContain("animateTransform");
  });
  it("名前の記号はエスケープされる。裏面には一言とやったこと", () => {
    const svg = renderCardSvg(art({ members: [{ name: "A&B <c>", teamId: "lupinus" }] }));
    expect(svg).toContain("A&amp;B &lt;c&gt;");
    expect(svg).not.toContain("A&B");
    const back = renderCardBackSvg(art(), { thanks: "ありがとう。助かりました！", subtasks: ["玄関前の通路（5分）"] });
    expect(back).toContain("ありがとう。");
    expect(back).toContain("玄関前の通路（5分）");
    expect(escapeXml('"q"')).toBe("&quot;q&quot;");
    expect(dateLabel("2026-12-13")).toBe("2026.12.13 SUN");
    expect(wrap("あいうえおかきくけこさしすせそたちつてと", 10)).toEqual(["あいうえおかきくけこ", "さしすせそたちつてと"]);
  });
  it("SNS 用の台紙に包める", () => {
    const sq = composeForExport(renderCardSvg(art()), "square");
    expect(sq).toContain('width="1080" height="1080"');
    expect(sq.match(/<svg/g)?.length).toBe(1);
    expect(composeForExport(renderCardSvg(art()), "portrait")).toContain('height="1350"');
  });
  it("日本語入りの SVG を PNG にできる（同梱フォント）", async () => {
    const png = await svgToPng(renderCardSvg(art()), { width: 300 });
    expect([...png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);
    expect(png.byteLength).toBeGreaterThan(10_000);
  });
});

describe("カードの文字（モック）と排雪量", () => {
  it("面積×深さ×密度で kg、身近な換算つき", () => {
    expect(estimateSnowKg(12, "entrance")).toBe(220);
    expect(estimateSnowKg(12, "road")).toBe(900);
    expect(snowComparison(900)).toBe("軽トラ1台分");
    const t = mockCardText({
      date: "2026-12-14", completedAtJst: "07:20", forecastCm: 12, level: 2, clearArea: "garage",
      memberCount: 2, teamNames: ["サルビア"], style: "retrowave", rarityLabel: "早朝の群れ",
    });
    expect(t.designName.length).toBeGreaterThan(0);
    expect(t.snowKg).toBe(540);
  });
  it("LINE には表と裏の画像 URL を2枚送る", () => {
    const msgs = cardImageMessages("c-1");
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ type: "image", originalContentUrl: expect.stringContaining("/api/cards/c-1/front.png") });
    expect((msgs[1] as { previewImageUrl: string }).previewImageUrl).toContain("back.png?size=preview");
  });
});

describe("完了するとカードが発行される", () => {
  it("写真で完了 → 来た人の数だけカード、通し番号は朝の中で続く", async () => {
    await memoryRepo.upsertParticipant({
      id: "p-card", nickname: "カード子", role: "helper", location: [43.0404, 141.3704], lineUserId: "U-card", teamId: "salvia", morningMinutes: 60, hasTools: true,
    });
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    const s = await loadMorning();
    fillAnswers(s, await loadRoster(), 11);
    s.answers.push({ rollcallId: s.morning.rollcall.id, participantId: "p-card", answer: 60, answeredAt: "2026-12-14T06:31:00+09:00" });
    await saveMorning(s);
    await plan();
    const planned = await loadMorning();
    const mine = planned.morning.sorties.find((x) => x.participantId === "p-card")!;
    const mates = planned.morning.sorties.filter((x) => x.missionId === mine.missionId);
    const r = await completeWithPhoto("p-card", { bytes: new Uint8Array([0xff, 0xd8, 0xff]), mediaType: "image/jpeg" }, new Date("2026-12-14T07:10:00+09:00"));
    expect(r.done).toBe(true);
    const cards = await memoryRepo.listCardsByRecipient("p-card");
    expect(cards).toHaveLength(1);
    expect(cards[0].memberNames).toHaveLength(mates.length);
    expect(cards[0].style).toBe(cards[0].teamIds.length >= 2 ? "eijin" : "retrowave"); // 7:10 完了
    expect(cards[0].issuedCount).toBe(planned.morning.sorties.length);
    expect(await memoryRepo.countCardsForRollcall(planned.morning.rollcall.id)).toBe(mates.length);
    const stored = await memoryRepo.getCard(cards[0].id);
    expect(stored?.svg).toContain(cards[0].designName);
    expect(stored?.backSvg).toContain("Thank you!");
    expect((await loadMorning()).log.at(-1)).toContain("枚発行");
  });
});
