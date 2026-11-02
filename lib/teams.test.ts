import { describe, expect, it } from "vitest";
import { TEAMS, getTeam } from "./teams";

describe("チーム定義", () => {
  it("3チームある", () => {
    expect(TEAMS.map((t) => t.id)).toEqual(["salvia", "marigold", "lupinus"]);
  });

  it("チーム色に赤と緑を使わない（地図の状態色と区別するため）", () => {
    for (const team of TEAMS) {
      const r = parseInt(team.color.slice(1, 3), 16);
      const g = parseInt(team.color.slice(3, 5), 16);
      const b = parseInt(team.color.slice(5, 7), 16);
      const isRed = r > 200 && g < 80 && b < 80;
      const isGreen = g > 180 && r < 120 && b < 140;
      expect(isRed || isGreen, team.name).toBe(false);
    }
  });

  it("ID でチームを引ける", () => {
    expect(getTeam("lupinus").name).toBe("ルピナス");
  });
});
