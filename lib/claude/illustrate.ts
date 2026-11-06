// 絵本のさし絵（spec v1.27）: カードの絵（lib/claude/art.ts）と同じやり方を、大きさと決めごとを選べる形にしたもの。
// 1回目: 決めごと（style bible）とページの指示から、Claude が SVG をゼロから描く
// 2回目: 描いた絵を画像にして見せ、直した最終版を描き直してもらう（見直し）
// どちらも lib/cards/svg-clean.ts で点検してから使う。文字は描かない。
import { z } from "zod";
import { cleanSvg } from "../cards/svg-clean";
import { svgToPng } from "../cards/png";
import { askJsonLong, hasClaudeKey } from "./client";

const IllustrationSchema = z.object({ svg: z.string() });

export interface IllustrationInput {
  width: number;
  height: number;
  /** 全ページ共通の決めごと（色・主役の姿・町の姿・タッチ） */
  style: { palette: string[]; hero: string; world: string; touch: string };
  /** このページで描くもの */
  scene: string;
  /** そのページの文（絵と文が合うように） */
  text?: string;
  /** 絵に入れてよい事実（チームの色・雪の量 など） */
  facts?: unknown;
  /** id の頭の印 */
  idPrefix: string;
}

const TAGS =
  "使える要素は g・path・circle・ellipse・rect・polygon・polyline・line・defs・use・linearGradient・radialGradient・stop・clipPath・mask・filter と fe で始まるフィルタだけ。" +
  "text・image・style 属性・CSS・外のファイルは使えません（使うと消えます）。属性で色や線を書きます。";

export function wrapIllustration(inner: string, w: number, h: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="#ffffff"/>${inner}</svg>`;
}

/** 1枚のさし絵をゼロから描く（見直し1回つき）。キーがなければ undefined */
export async function drawIllustration(input: IllustrationInput, opts: { review?: boolean; budgetMs?: number } = {}): Promise<{ svg: string; rounds: number } | undefined> {
  if (!hasClaudeKey()) return undefined;
  const started = Date.now();
  const modelId = process.env.CARD_ART_MODEL?.trim() || undefined;
  const rules =
    "採点表 book.picture の規則に従ってください。" +
    `キャンバスは幅${input.width}×高さ${input.height}（座標 0〜${input.width} × 0〜${input.height}）。<svg> の中身だけを svg に入れます。` +
    "style（決めごと）の palette・hero・world・touch を必ず守り、ほかのページと同じ絵本に見えるようにします。" +
    TAGS;
  const facts = { ...input, idPrefix: undefined };
  const first = await askJsonLong({
    task:
      "週刊絵本のさし絵を、ゼロから1枚描いてください。scene のとおりの場面を、絵本の1ページとして見ごたえのある絵に。" +
      "グラデーションとやさしい影で奥行き（遠景・中景・近景）を出し、図形は 150〜500 個、合わせて 60KB まで。文字や数字は描きません。" +
      rules,
    input: facts,
    schema: IllustrationSchema,
    effort: "high",
    modelId,
  });
  const draft = cleanSvg(first.svg, input.idPrefix);
  if (!draft) throw new Error("さし絵が点検を通りませんでした");
  if (opts.review === false || Date.now() - started > (opts.budgetMs ?? 150_000)) return { svg: draft.svg, rounds: 1 };
  try {
    const png = await svgToPng(wrapIllustration(draft.svg, input.width, input.height), { width: input.width });
    const second = await askJsonLong({
      task:
        "画像は、あなたがいま描いたさし絵を表示したものです。絵本の1ページとして見直して、もっと良い最終版を描き直してください。" +
        "確かめること: 決めごと（色・主役の姿・町の姿・タッチ）を守っているか／主役が小さすぎないか／はみ出し・不自然な重なり・何もない空白／scene と text が絵から伝わるか。" +
        "良いところは残し、直すところだけ直して、svg 全体を返します。" +
        rules,
      input: { ...facts, draftSvg: draft.svg.slice(0, 80_000) },
      images: [{ mediaType: "image/png", base64: Buffer.from(png).toString("base64") }],
      schema: IllustrationSchema,
      effort: "high",
      modelId,
    });
    const fixed = cleanSvg(second.svg, input.idPrefix);
    return fixed ? { svg: fixed.svg, rounds: 2 } : { svg: draft.svg, rounds: 1 };
  } catch (e) {
    console.error("[book] さし絵の見直しに失敗（1回目を使います）:", e instanceof Error ? e.message : e);
    return { svg: draft.svg, rounds: 1 };
  }
}
