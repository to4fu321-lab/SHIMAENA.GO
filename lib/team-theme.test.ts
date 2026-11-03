import { describe, expect, it } from "vitest";
import { MSG } from "./line/messages";
import { teamAnnounceSvg, teamAnnounceText } from "./team-announce";
import { nextTeamTerm, scarfOf, teamTerm, teamTheme } from "./team-theme";
import { TEAMS } from "./teams";

/** WCAG のコントラスト比 */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("1週間のチームの期間（月曜〜日曜）", () => {
  it("水曜はその週の月曜〜日曜", () => {
    expect(teamTerm("2026-11-04")).toMatchObject({ from: "2026-11-02", to: "2026-11-08", label: "11/2（月）〜11/8（日）", until: "11/8（日）の夜まで" });
  });
  it("月曜も日曜も同じ週（日曜はその週の最後の日）", () => {
    expect(teamTerm("2026-11-02").to).toBe("2026-11-08");
    expect(teamTerm("2026-11-08").from).toBe("2026-11-02");
  });
  it("日曜の夜の組み直しは、翌日の月曜からの1週間", () => {
    expect(nextTeamTerm("2026-11-08")).toMatchObject({ from: "2026-11-09", to: "2026-11-15" });
  });
});

describe("チームの色", () => {
  it("白地の文字・チーム色の上の文字が読める", () => {
    for (const t of TEAMS) {
      const th = teamTheme(t.id);
      expect(contrast(th.deep, "#FFFFFF"), t.name).toBeGreaterThanOrEqual(4.5);
      expect(contrast(th.onColor, t.color), t.name).toBeGreaterThanOrEqual(3); // 大きな太字
    }
  });
  it("シマエナガのマフラーはチームの色、チームがなければ灯りオレンジ", () => {
    expect(scarfOf("salvia").color).toBe("#2F6FE4");
    expect(scarfOf(undefined).color).toBe("#e8834f");
  });
});

describe("チーム発表", () => {
  const term = nextTeamTerm("2026-11-08");
  it("文にチーム名・色・期間・組み直しの説明が入る", () => {
    const t = teamAnnounceText("lupinus", term, "weekly");
    expect(t).toContain("今週のチーム発表");
    expect(t).toContain("「ルピナス」チーム（紫）");
    expect(t).toContain("11/9（月）〜11/15（日）");
    expect(t).toContain("毎週日曜の夜に組み直します");
  });
  it("LINE は画像1枚と文（チームを見るボタン）", () => {
    const msgs = MSG.weeklyNewTeam("marigold", term);
    expect(msgs[0]).toMatchObject({ type: "image", originalContentUrl: expect.stringContaining("/api/team/marigold.png?from=2026-11-09") });
    expect(msgs[1]).toMatchObject({ type: "text", quickReply: { items: [{ action: { label: "チームを見る" } }] } });
  });
  it("登録したときも発表が届く", () => {
    const msgs = MSG.helperDone("salvia", teamTerm("2026-11-04"));
    expect(msgs.map((m) => m.type)).toEqual(["text", "image", "text", "text"]);
    expect(JSON.stringify(msgs)).toContain("チームが決まりました");
  });
  it("画像の SVG にチーム名と期間、チーム色のマフラー", () => {
    const svg = teamAnnounceSvg("salvia", term);
    expect(svg).toContain("サルビア");
    expect(svg).toContain("11/9（月）〜11/15（日） の1週間");
    expect(svg).toContain('fill="#2F6FE4"');
  });
});
