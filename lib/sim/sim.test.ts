// テストモード: AI 参加者 20 人・依頼 10 件の雪の朝を動かし、全部クリアしてカードが出るかを確かめる。
// SIM_OUT=<フォルダ> を付けると、テストの様子（report.html）をそのフォルダに書き出す（npm run sim）。
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { runSimulation } from "./run";
import { renderReport } from "./report";

describe("テストモード（AI 参加者 20 人・依頼 10 件）", () => {
  it("10 軒をクリアして、来た人の数だけイラストカードが出る", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const report = await runSimulation();
    const out = process.env.SIM_OUT;
    if (out) {
      mkdirSync(out, { recursive: true });
      writeFileSync(path.join(out, "report.html"), renderReport(report));
      writeFileSync(path.join(out, "report.json"), JSON.stringify({ ...report, cards: report.cards.map((c) => ({ ...c, svg: undefined, backSvg: undefined })) }, null, 2));
    }
    for (const c of report.checks) expect(c.ok, `${c.name}: ${c.detail}`).toBe(true);
  }, 60_000);
});
