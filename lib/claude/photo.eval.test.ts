// 完了写真の確認を、本物の Claude で確かめる評価セット（spec v1.8）。ふだんの `npm run check` では動かない（キーと写真があるときだけ）。
// 使い方:
//   1. eval/photos/ に写真を置く（例: cleared-1.jpg）。家や人が写るのでリポジトリには入れない（.gitignore 済み）。
//   2. eval/photos/expected.json に正解を書く: { "cleared-1.jpg": { "outcome": "done" }, "room.jpg": { "outcome": "retry", "unrelated": true } }
//      outcome は done（完了）／accepted（判断できず受け付け）／retry（もう一度）。
//   3. ANTHROPIC_API_KEY=… EVAL_PHOTOS=1 npx vitest run lib/claude/photo.eval.test.ts
//   4. 結果の表が docs/eval/photo.md にできる（数字は実測だけ。失敗も載る）。
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sniffImageType } from "../image";
import { checkPhoto, decidePhoto, WIDTH_LABEL } from "./photo";

const DIR = path.join(process.cwd(), "eval", "photos");
const ready = Boolean(process.env.EVAL_PHOTOS && process.env.ANTHROPIC_API_KEY && existsSync(path.join(DIR, "expected.json")));

describe.skipIf(!ready)("写真の評価セット（本物の Claude）", () => {
  it("正解と比べて表を書く", async () => {
    const expected = JSON.parse(readFileSync(path.join(DIR, "expected.json"), "utf8")) as Record<string, { outcome: string; unrelated?: boolean }>;
    const files = readdirSync(DIR).filter((f) => expected[f]);
    const rows: string[] = [];
    let hit = 0;
    for (const f of files) {
      const bytes = new Uint8Array(readFileSync(path.join(DIR, f)));
      const mediaType = sniffImageType(bytes);
      if (!mediaType) continue;
      const started = Date.now();
      const c = await checkPhoto({ bytes, mediaType });
      const ms = Date.now() - started;
      const outcome = decidePhoto(c);
      const ok = outcome === expected[f].outcome && (expected[f].unrelated === undefined || expected[f].unrelated === Boolean(c.unrelated));
      if (ok) hit++;
      rows.push(
        `| ${f} | ${expected[f].outcome} | ${outcome} | ${ok ? "○" : "×"} | ${c.evidence ?? ""} | ${c.width ? WIDTH_LABEL[c.width] : ""} | ${(c.hazards ?? []).join("・")} | ${ms}ms |`,
      );
    }
    const md = [
      "# 完了写真の確認の評価（本物の Claude）",
      "",
      `- 実行: ${new Date().toISOString()}`,
      `- 一致: ${hit} / ${rows.length}`,
      "- 写真はリポジトリに入れていない（家や人が写るため）。判定と根拠だけを残す。",
      "",
      "| 写真 | 正解 | 判定 | 一致 | Claude の根拠 | 幅 | 危ないもの | 時間 |",
      "|---|---|---|---|---|---|---|---|",
      ...rows,
      "",
    ].join("\n");
    mkdirSync(path.join(process.cwd(), "docs", "eval"), { recursive: true });
    writeFileSync(path.join(process.cwd(), "docs", "eval", "photo.md"), md);
    expect(rows.length).toBeGreaterThan(0);
  }, 600_000);
});
