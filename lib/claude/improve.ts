// 改善の提案（spec v1.17）: 1週間の「声」（要約だけ）を Claude が読み、よくある声・件数・直し方の案・仕様のどこ を3〜5件に。
// 提案は本人が読んで採用を決める（AI は勝手に仕様や画面を変えない）。キーがないときは種類ごとの数から定型で。
import { z } from "zod";
import { MOTIVE_LABEL, type Motive } from "../concierge/profile";
import { VOICE_LABEL, type Proposal, type VoiceCategory } from "../voice/store";
import { askJson, hasClaudeKey } from "./client";

export const ProposalSchema = z.object({
  title: z.string(),
  voices: z.number(),
  change: z.string(),
  where: z.string(),
  priority: z.enum(["高", "中", "低"]),
});
export const ImproveSchema = z.object({ proposals: z.array(ProposalSchema) });

export interface ImproveInput {
  from: string;
  to: string;
  total: number;
  counts: Record<VoiceCategory, number>;
  /** 声（要約だけ。誰の声かは渡さない） */
  voices: { category: VoiceCategory; summary: string; motives: Motive[]; picked?: string }[];
}

const MAX = 5;

/** 言葉の一覧（キーなし・Claude が失敗したとき）: 種類ごとの数から定型の提案 */
export function mockProposals(input: ImproveInput): Proposal[] {
  const out: Proposal[] = [];
  const { counts } = input;
  const motiveCount: Record<Motive, number> = { connect: 0, exercise: 0, community: 0, game: 0 };
  for (const v of input.voices) for (const m of v.motives) motiveCount[m]++;
  const topMotive = (Object.keys(motiveCount) as Motive[]).sort((a, b) => motiveCount[b] - motiveCount[a])[0];
  if (counts.confusion > 0) out.push({ title: "分からない所を使い方に足す", voices: counts.confusion, change: "「分からない」の声の多い場面を、使い方のスライドと隊長の最初のひとことに足す", where: "10.5 使い方・v1.6 隊長のひとこと", priority: counts.confusion >= 3 ? "高" : "中" });
  if (counts.trouble > 0) out.push({ title: "困りごとの場面を確かめる", voices: counts.trouble, change: "困りごとの要約を読み、同じ画面で詰まる人がいないか実機で確かめる", where: "該当の画面", priority: counts.trouble >= 3 ? "高" : "中" });
  if (counts.feature > 0) out.push({ title: "機能の要望を仕様の提案に", voices: counts.feature, change: "要望の要約を devlog の「提案」にまとめ、本人が採用を決める", where: "docs/devlog.md 提案", priority: "中" });
  if (topMotive && motiveCount[topMotive] > 0) out.push({ title: `「${MOTIVE_LABEL[topMotive]}」を求める人が多い`, voices: motiveCount[topMotive], change: `${MOTIVE_LABEL[topMotive]}に合う候補（コンシェルジュ）と画面の入口を増やす`, where: "v1.17 自由な相談とマッチング", priority: "低" });
  if (counts.praise > 0) out.push({ title: "うれしい声を次の文面に", voices: counts.praise, change: "うれしかった場面を、完了画面と隊長のひとことで大事にする（変えない）", where: "9 Claude の役割", priority: "低" });
  return out.slice(0, MAX);
}

/** Claude の答えを、そのまま使ってよい形に */
export function tidyProposals(ps: Proposal[], input: ImproveInput): Proposal[] {
  return ps
    .map((p) => ({
      title: p.title.replace(/\s+/g, " ").trim().slice(0, 30),
      voices: Math.max(0, Math.min(input.total, Math.round(Number(p.voices) || 0))),
      change: p.change.replace(/\s+/g, " ").trim().slice(0, 80),
      where: p.where.replace(/\s+/g, " ").trim().slice(0, 30),
      priority: (["高", "中", "低"] as const).includes(p.priority) ? p.priority : ("中" as const),
    }))
    .filter((p) => p.title && p.change)
    .slice(0, MAX);
}

export async function improveProposals(input: ImproveInput): Promise<{ proposals: Proposal[]; byClaude: boolean }> {
  if (input.total === 0) return { proposals: [], byClaude: false };
  if (!hasClaudeKey()) return { proposals: mockProposals(input), byClaude: false };
  try {
    const res = await askJson({
      task:
        "1週間に隊長トークへ届いた相談から読み取った「声」（要約だけ）を読み、採点表 improve の規則で、シマエナGO の改善の提案を3〜5件書いてください。" +
        `種類: ${Object.entries(VOICE_LABEL).map(([k, v]) => `${k}=${v}`).join("・")}。方向: ${Object.entries(MOTIVE_LABEL).map(([k, v]) => `${k}=${v}`).join("・")}。` +
        "同じ内容の声はまとめ、voices にその数を入れる（input にない数は作らない）。where は仕様のどこか（章や版）。priority は 高／中／低。提案は人が読んで採用を決めるので、「何を・どう直すか」を短く具体的に。",
      input,
      schema: ImproveSchema,
      effort: "medium",
    });
    const ps = tidyProposals(res.proposals, input);
    return ps.length > 0 ? { proposals: ps, byClaude: true } : { proposals: mockProposals(input), byClaude: false };
  } catch (e) {
    console.error("[improve] Claude が使えないので定型で:", e instanceof Error ? e.message : e);
    return { proposals: mockProposals(input), byClaude: false };
  }
}
