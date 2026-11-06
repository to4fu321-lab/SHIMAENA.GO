// 1週間の声 → 改善の提案（spec v1.17）。日曜の「今週の群れ」のあとに書く。/admin の「声」タブのボタンでも書ける。
import { improveProposals } from "../claude/improve";
import { weekStart } from "../game/week";
import { loadMorning } from "../morning/store";
import { appToday } from "../morning/today";
import { countByCategory, listVoicesBetween, saveImprovement, type Improvement } from "./store";

export async function writeImprovements(now = new Date()): Promise<Improvement> {
  const to = appToday(await loadMorning(), now); // アプリの「今日」（デモの朝なら点呼の日付）に合わせる
  const from = weekStart(to);
  const voices = await listVoicesBetween(from, to);
  const counts = countByCategory(voices);
  const { proposals, byClaude } = await improveProposals({
    from,
    to,
    total: voices.length,
    counts,
    voices: voices.map((v) => ({ category: v.category, summary: v.summary, motives: v.motives, ...(v.picked ? { picked: v.picked } : {}) })), // 誰の声かは渡さない
  });
  const imp: Improvement = { weekStart: from, from, to, total: voices.length, counts, proposals, at: now.toISOString(), byClaude };
  await saveImprovement(imp);
  return imp;
}
