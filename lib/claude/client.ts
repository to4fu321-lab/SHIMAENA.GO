// Claude 呼び出しの共通部分。サーバー側でだけ使う（API キーを画面に出さない）。
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import rubric from "@/data/rubric.json";

export const CLAUDE_MODEL = "claude-opus-5-5";
/** 短い文・簡単な言葉の仕事に使う安いモデル（spec v1.6、本人の了承済み） */
export const CLAUDE_LIGHT_MODEL = "claude-haiku-5-5";

/** キーがあれば本物の Claude、なければモック（T04 の計算）で同じ形の答えを返す */
export function hasClaudeKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// 毎回同じ文面にして、キャッシュが効くようにする（日時や ID を入れない）
const SYSTEM = `あなたは札幌の町内会で使う雪かきゲーム「シマエナGO」の司令官「シマエナ隊長」です。
雪の朝、ひとり暮らしの高齢者の家の雪かきを、町内の3チーム（サルビア・マリーゴールド・ルピナス）に割り振ります。
次の採点表に必ず従って判定してください。採点表にないことは、小さく安全なほうを選びます。
文章の口調は採点表の voice に従います（口調は判定に影響しません）。

採点表（JSON）:
${JSON.stringify(rubric, null, 2)}`;

let client: Anthropic | undefined;
function getClient(): Anthropic {
  client ??= new Anthropic();
  return client;
}

export class ClaudeRefusalError extends Error {}

export interface AskJsonOptions<S extends z.ZodType> {
  /** 何をしてほしいか（日本語） */
  task: string;
  /** 判定の材料。JSON にして渡す */
  input: unknown;
  /** 返してほしい形 */
  schema: S;
  /** 考える深さ。単純な判定は low、作戦は medium */
  effort?: "low" | "medium" | "high";
  /** main = Opus（判断・写真・ことばの読み取り）、light = Haiku（短い文）。既定は main */
  model?: "main" | "light";
  /** 写真（完了写真の確認などで使う） */
  images?: { mediaType: "image/jpeg" | "image/png" | "image/webp"; base64: string }[];
}

/**
 * Web 検索つきで、文で答えてもらう（spec v1.23 今日の話題）。検索は Anthropic のサーバーで動く（web_search）。
 * 長い検索で止まった（pause_turn）ときは、2回まで続きを頼む。答えの文だけを返す
 */
export async function askWithWebSearch(task: string, opts: { maxUses?: number } = {}): Promise<string> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: task }];
  for (let turn = 0; turn < 3; turn++) {
    const res = await getClient().beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "low" },
      tools: [
        {
          type: "web_search_20260209",
          name: "web_search",
          max_uses: opts.maxUses ?? 3,
          user_location: { type: "approximate", city: "Sapporo", region: "Hokkaido", country: "JP", timezone: "Asia/Tokyo" },
        },
      ],
      messages,
    });
    if (res.stop_reason === "refusal") throw new ClaudeRefusalError("Claude がこの依頼を断りました");
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
  }
  throw new Error("Web 検索が終わりませんでした");
}

/**
 * 長い答え（絵の SVG など）を JSON でもらう（spec v1.24）。長いので流しながら受け取る（途中で切れないように）。
 * model を渡すとそのモデル（例: 環境変数 CARD_ART_MODEL）。形は schema で確かめる
 */
export async function askJsonLong<S extends z.ZodType>(opts: AskJsonOptions<S> & { maxTokens?: number; modelId?: string }): Promise<z.infer<S>> {
  const model = opts.modelId ?? CLAUDE_MODEL;
  const stream = getClient().beta.messages.stream({
    model,
    max_tokens: opts.maxTokens ?? 64000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: opts.effort ?? "high", format: betaZodOutputFormat(opts.schema) },
    messages: [
      {
        role: "user",
        content: [
          ...(opts.images ?? []).map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
          })),
          { type: "text" as const, text: `${opts.task}\n\n入力（JSON）:\n${JSON.stringify(opts.input)}` },
        ],
      },
    ],
  });
  const res = await stream.finalMessage();
  if (res.stop_reason === "refusal") throw new ClaudeRefusalError("Claude がこの依頼を断りました");
  if (res.stop_reason === "max_tokens") throw new Error("Claude の答えが長すぎて途中で切れました");
  const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  return opts.schema.parse(JSON.parse(text)) as z.infer<S>;
}

/** Claude に JSON で答えてもらう。形は schema で保証される */
export async function askJson<S extends z.ZodType>(opts: AskJsonOptions<S>): Promise<z.infer<S>> {
  const light = opts.model === "light";
  const res = await getClient().beta.messages.parse({
    model: light ? CLAUDE_LIGHT_MODEL : CLAUDE_MODEL,
    max_tokens: 16000,
    // 安全のための自動判定で断られたときは、サーバー側で別のモデルに切り替えて続ける（Haiku にはこの仕組みがない）
    ...(light ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }),
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    output_config: { effort: opts.effort ?? "low", format: betaZodOutputFormat(opts.schema) },
    messages: [
      {
        role: "user",
        content: [
          ...(opts.images ?? []).map((img) => ({
            type: "image" as const,
            source: { type: "base64" as const, media_type: img.mediaType, data: img.base64 },
          })),
          { type: "text" as const, text: `${opts.task}\n\n入力（JSON）:\n${JSON.stringify(opts.input)}` },
        ],
      },
    ],
  });
  if (res.stop_reason === "refusal") {
    throw new ClaudeRefusalError("Claude がこの依頼を断りました");
  }
  if (res.parsed_output == null) {
    throw new Error(`Claude の答えを読み取れませんでした（stop_reason: ${res.stop_reason}）`);
  }
  return res.parsed_output as z.infer<S>;
}

/** 道具を使う会話（隊長エージェント、spec v1.25）で、自分でやり取りを回すための入口 */
export const getClaudeClient = (): Anthropic => getClient();
/** 毎回同じ前置き（採点表つき）。キャッシュが効くよう、そのまま使う */
export const SYSTEM_PROMPT = SYSTEM;
