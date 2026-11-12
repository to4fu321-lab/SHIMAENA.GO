// カードの絵を、毎回ゼロから Claude が描く（spec v1.24・採点表 cardArt.picture）。
// 1回目: その時の事実・今日の話題・タッチ・プログラムが毎回くじで決める構図と色から、絵全体を SVG で描く
// 2回目: 描いた絵を画像にして Claude に見せ、はみ出し・重なり・空白・主役の小ささなどを直した最終版を描き直してもらう
// どちらも lib/cards/svg-clean.ts で点検してから使う。文字は描かない（名前や数字はプログラムが枠に入れる）。
import { z } from "zod";
import { cleanSvg } from "../cards/svg-clean";
import { svgToPng } from "../cards/png";
import type { CardStyle } from "../types";
import { askJsonLong, hasClaudeKey } from "./client";

export const PIC_W = 540;
export const PIC_H = 560;

const ArtSchema = z.object({
  /** 絵の SVG（<svg> の中身。座標は 0〜540 × 0〜560） */
  svg: z.string(),
  /** なぜこの絵か（40字まで） */
  why: z.string(),
});

export interface ArtInput {
  date: string;
  completedAtJst: string;
  sky: string; // 朝焼け・昼の光・夕暮れ・夜
  fall: string; // やんだ雪・粉雪・ぼた雪・大雪
  groundCm: number;
  members: { teamColor: string; teamName: string }[];
  topic?: { label: string; hint: string };
  style: CardStyle;
  mood: string;
  props: string[];
  designName: string;
  /** くじの種（その家・その時） */
  seed: string;
}

export interface DrawnArt {
  svg: string;
  why: string;
  /** 見直しの前の1回目（試し描きで並べて見せる） */
  draft?: string;
  rounds: number;
  seconds: number;
}

const TOUCH: Record<CardStyle, string> = {
  kawaii: "パステル×ネオン×メンフィス柄のかわいいシティポップ。丸みのある形、ピンク・ラベンダー・ミントの地に、ネオンの線と小さな幾何学模様",
  retrowave: "80年代レトロウェーブ。夜明け前の紫〜マゼンタの空、ネオンの輪郭線、遠くの山並みと光るグリッド、横縞の太陽",
  kirie: "切り絵。紙を重ねたような、くっきりした面と影。色は4〜5色にしぼり、紙の重なりで奥行きを出す",
  pixel: "ドット絵。すべて 8px の格子にそろえた四角（rect）だけで描く。16色くらいの限られた色",
  eijin: "鈴木英人のような明るいフラットなイラスト。抜けるような青空、くっきりした輪郭、ビビッドな色の面、強い日差しの影",
};

// 毎回のくじ（同じものが続かないよう、プログラムが決めて Claude に渡す）
const COMPOSITION = [
  "正面から玄関を見る。手前に雪かきした道が玄関へまっすぐ伸びる",
  "少し高いところから見下ろす。家の屋根と、雪の中に切り開いた道の形がよく見える",
  "低い目線で、道の奥に家。手前に雪の壁とスコップが大きく入る",
  "横長のパノラマ。家並みと電線、その下で小鳥たちが並んで作業している",
  "斜め45度から。玄関前の階段と、道路へ続く通路が対角線になる",
  "玄関の灯りを中心に、まわりを雪の夜（または朝）の空気が包む、近めの構図",
];
const ACCENT = ["#ff7ab8", "#2ee6ff", "#ffd400", "#9b5de5", "#ff8a3d", "#5ad1a3", "#ff4f8b", "#6fb6ff"];
const FIND = ["小さな雪だるま", "猫の足あと", "屋根のつらら", "湯気の立つ湯のみ", "雪をかぶった郵便受け", "赤い手袋の片方", "そりの跡", "窓辺の植木鉢", "雪の上のスズメ"];

function lottery(seed: string) {
  let a = 7;
  for (const ch of seed) a = (a * 131 + ch.charCodeAt(0)) >>> 0;
  const pick = <T>(xs: T[]) => {
    a = (a * 1103515245 + 12345) >>> 0;
    return xs[a % xs.length];
  };
  return { composition: pick(COMPOSITION), accent: pick(ACCENT), find: pick(FIND) };
}

const RULES =
  "採点表 cardArt.picture の規則に従って描いてください。" +
  `キャンバスは幅${PIC_W}×高さ${PIC_H}（座標 0〜${PIC_W} × 0〜${PIC_H}）。<svg> の中身だけを svg に入れます。` +
  "使える要素は g・path・circle・ellipse・rect・polygon・polyline・line・defs・use・linearGradient・radialGradient・stop・clipPath・mask・filter と fe で始まるフィルタだけ。" +
  "text・image・style 属性・CSS・外のファイルは使えません（使うと消えます）。属性で色や線を書きます。";

/** その時の材料から、Claude に1枚の絵をゼロから描いてもらう（見直し1回つき）。キーがなければ undefined */
export async function drawPicture(input: ArtInput, opts: { review?: boolean; until?: number } = {}): Promise<DrawnArt | undefined> {
  if (!hasClaudeKey()) return undefined;
  const started = Date.now();
  const modelId = process.env.CARD_ART_MODEL?.trim() || undefined;
  const lot = lottery(input.seed);
  const prefix = `a${input.seed.replace(/[^A-Za-z0-9]/g, "").slice(-8)}`;
  const facts = {
    ...input,
    seed: undefined,
    touch: TOUCH[input.style],
    composition: lot.composition,
    accentColor: lot.accent,
    smallDiscovery: lot.find,
    birds: input.members.length,
  };
  const first = await askJsonLong({
    task:
      "雪かきのお礼のカードに入れる絵を、ゼロから1枚描いてください。この1枚のためだけの、ほかと似ていない絵にします。" +
      "主役は、耳あてをしたシマエナガ（白くて丸い小鳥。小さな黒い目とくちばし、黒っぽい翼と長い尾）たち。数は birds、耳あての色は members の teamColor。スコップを持って雪かきをしている。" +
      "場面は、雪の朝（または時刻どおりの空）に、ひとり暮らしの家の玄関から道路まで、みんなで道を開いたところ。sky・fall・groundCm のとおりの空と雪。" +
      "topic（今日の話題）があれば、それが見てすぐわかる形で絵の中に入れる。composition（構図）・touch（タッチ）・accentColor（差し色）・smallDiscovery（小さな発見）を必ず守る。" +
      "グラデーションと影で奥行き（遠景・中景・近景の3層以上）を出し、図形は 150〜500 個、合わせて 60KB まで。" +
      "右上（x 400 より右・y 170 より上）には消印が押されるので、大事なものを置かない。why には、なぜこの絵か（事実だけ、40字まで、名前なし）。" +
      RULES,
    input: facts,
    schema: ArtSchema,
    effort: "high",
    modelId,
  });
  const draft = cleanSvg(first.svg, prefix);
  if (!draft) throw new Error("描いた絵が点検を通りませんでした（図形が少ない・大きすぎる）");
  let final = draft.svg;
  let why = first.why;
  let rounds = 1;
  // 見直し: 描いた絵を画像にして見せ、直してもらう（4分の予算のうち、1回目で2分半を超えたら見直さない）
  // until（締切）があるときは、見直しに 100 秒残っていなければ見直さない（締切を過ぎると、1回目の絵まで捨てることになる）
  if (opts.review !== false && Date.now() - started < 150_000 && (opts.until === undefined || opts.until - Date.now() > 100_000)) {
    try {
      const png = await svgToPng(wrapPicture(draft.svg), { width: PIC_W });
      const second = await askJsonLong({
        task:
          "画像は、あなたがいま描いた絵を実際に表示したものです。カードの絵として見直して、もっと良い最終版を描き直してください。" +
          "確かめること: 主役のシマエナガが小さすぎないか・数と耳あての色が合っているか／はみ出し・切れ・不自然な重なり／何もない空白／今日の話題が伝わるか／構図とタッチが指示どおりか／色の調和と奥行き。" +
          "良いところは残し、直すところだけ直して、svg 全体を返します。" +
          RULES,
        input: { ...facts, draftSvg: draft.svg.slice(0, 80_000) },
        images: [{ mediaType: "image/png", base64: Buffer.from(png).toString("base64") }],
        schema: ArtSchema,
        effort: "high",
        modelId,
      });
      const fixed = cleanSvg(second.svg, prefix);
      if (fixed) {
        final = fixed.svg;
        why = second.why || why;
        rounds = 2;
      }
    } catch (e) {
      console.error("[art] 見直しに失敗（1回目の絵を使います）:", e instanceof Error ? e.message : e);
    }
  }
  return { svg: final, why: why.replace(/\s+/g, "").slice(0, 40), draft: rounds === 2 ? draft.svg : undefined, rounds, seconds: (Date.now() - started) / 1000 };
}

/** 絵だけを1枚の SVG に（見直し用の画像・試し描き） */
export function wrapPicture(inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PIC_W} ${PIC_H}" width="${PIC_W}" height="${PIC_H}"><rect width="${PIC_W}" height="${PIC_H}" fill="#ffffff"/>${inner}</svg>`;
}
