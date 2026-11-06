// カードの文字: デザイン名・英語副題・排雪量と身近な換算（spec 7, 9-4）。絵は lib/cards/svg.ts が描く。
// v1.8: 排雪 kg はプログラムが計算する（lib/snow-estimate.ts。写真の深さ・予報・積雪深を突き合わせる）。Claude は名前と副題とひとことだけ。
import { z } from "zod";
import { STYLE_NAME } from "../cards/rarity";
import type { CardStyle, ClearArea, SnowType } from "../types";
import { askJson, hasClaudeKey } from "./client";
import { SNOW_TYPE_LABEL } from "./photo";
import { estimateDepth, kgBasis, snowKgOf, type PhotoDepth } from "../snow-estimate";
import { mockSceneChoice, MOODS, PROP_LABEL, SCENE_PROPS, sceneCode, sceneFacts, tidySceneChoice, type CardScene } from "../cards/scene";
import { snowComparison } from "../snowkg";
import { MotifSchema, programMotif, sanitizeMotif } from "../cards/motif";
import type { TopicItem } from "../topic/day";

/** Claude に書いてもらうのは名前・副題・ひとことだけ */
export const CardTextSchema = z.object({
  designName: z.string(), // 例: 玄関までの三十歩
  designNameEn: z.string(), // 例: Thirty Steps to the Door
  /** 絵の中の英語のひとこと（5語まで） */
  flavor: z.string(),
  /** v1.8 その時だけの場面: 持ち物を2つ（候補から）・雰囲気・なぜこの絵か（40字まで） */
  props: z.array(z.enum(SCENE_PROPS)),
  mood: z.enum(MOODS),
  why: z.string(),
  /** v1.23: 今日の話題から選んだ1つ（input.topics の label のどれか） */
  topicLabel: z.string(),
  /** v1.23: その話題とその時の事実から描く挿絵（120×120 の図形） */
  motif: MotifSchema,
});
export interface CardText extends Omit<z.infer<typeof CardTextSchema>, "props" | "mood" | "why" | "topicLabel" | "motif"> {
  /** その時だけの場面（設計図の番号つき） */
  scene: CardScene;
  snowKg: number;
  snowKgComparison: string; // 例: 軽トラ1台分
  /** 計算の元（例: 写真から約20〜30cm × 玄関前 12m² × 重い湿り雪） */
  snowKgBasis: string;
}

export interface CardTextInput {
  date: string;
  completedAtJst: string; // HH:mm
  forecastCm: number;
  level: 1 | 2 | 3;
  clearArea: ClearArea;
  memberCount: number;
  teamNames: string[];
  style: CardStyle;
  rarityLabel: string;
  /** 写真から見えた雪質（v1.2）。排雪 kg の密度に使う */
  snowType?: SnowType;
  /** v1.8: 写真から読んだ雪の断面の深さと、朝の積雪深（モデル） */
  photoDepth?: PhotoDepth;
  modelDepthCm?: number;
  /** v1.8 場面の材料: 完了した時（日本時間の時）・ありがとうが届いたか・2チーム以上か・設計図の番号の種（その家とその時の ID） */
  completedHour?: number;
  thanks?: boolean;
  mixed?: boolean;
  seed?: string;
  /** v1.23: 今日の話題（時事。lib/topic/day.ts）。ないときは話題なしの絵 */
  topics?: TopicItem[];
}

/** その時だけの場面: 空・雪・積もり方は事実から、持ち物・雰囲気・理由は Claude（なければ事実から決まる選び方） */
export function buildScene(
  input: CardTextInput,
  choice?: { props?: string[]; mood?: string; why?: string; topicLabel?: string; motif?: z.infer<typeof MotifSchema> },
): CardScene {
  const depth = estimateDepth({ forecastCm: input.forecastCm, modelDepthCm: input.modelDepthCm, photo: input.photoDepth });
  const hour = input.completedHour ?? Number(input.completedAtJst.slice(0, 2));
  const facts = sceneFacts({ completedHour: hour, snowType: input.snowType, forecastCm: input.forecastCm, depthCm: depth.cm });
  const fallback = mockSceneChoice(facts, { thanks: input.thanks, members: input.memberCount, mixed: input.mixed ?? input.teamNames.length >= 2 });
  const allowed = [input.memberCount, input.forecastCm, hour, Number(input.completedAtJst.slice(3, 5)), depth.cm];
  const c = choice ? tidySceneChoice(choice, fallback, allowed) : fallback;
  const base = { ...facts, props: c.props, mood: c.mood };
  const code = sceneCode(input.seed ?? `${input.date}|${input.completedAtJst}`, base);
  // v1.23 今日の話題と挿絵: Claude の選んだ話題が候補の中にあり、絵が点検を通れば Claude の絵。だめならプログラムの絵
  const topics = input.topics ?? [];
  const pick = topics.find((t) => t.label === choice?.topicLabel?.trim()) ?? topics[parseInt(code, 16) % Math.max(1, topics.length)];
  if (!pick) return { ...base, why: c.why, code };
  const drawn = choice?.motif ? sanitizeMotif(choice.motif, pick.label) : undefined;
  return { ...base, why: c.why, code, topic: pick.label, motif: drawn ?? programMotif(`${input.seed ?? code}|${code}`, pick.label, pick.motif) };
}

/** 排雪 kg と換算と計算の元（プログラムが決める） */
export function cardSnow(input: Pick<CardTextInput, "forecastCm" | "clearArea" | "snowType" | "photoDepth" | "modelDepthCm">): Pick<CardText, "snowKg" | "snowKgComparison" | "snowKgBasis"> {
  const d = estimateDepth({ forecastCm: input.forecastCm, modelDepthCm: input.modelDepthCm, photo: input.photoDepth });
  const snowKg = snowKgOf(d.cm, input.clearArea, input.snowType);
  return { snowKg, snowKgComparison: snowComparison(snowKg), snowKgBasis: kgBasis(d, input.clearArea, input.snowType) };
}

/** 排雪 kg = 面積 × 深さ × 雪質の密度（粉雪 100 / ふつう 150 / 湿り雪 300 / 凍結 400 kg/m³）。予報の降雪量だけで計算するとき */
export function estimateSnowKg(forecastCm: number, clearArea: ClearArea, snowType: SnowType = "unknown"): number {
  return snowKgOf(forecastCm, clearArea, snowType);
}

export { snowComparison };

const NAMES: Record<CardStyle, [string, string, string][]> = {
  kawaii: [
    ["玄関までの三十歩", "Thirty Steps to the Door", "Have a nice snow day!"],
    ["朝いちばんの白い道", "First White Road", "Good morning, snow!"],
    ["スコップと湯気", "Shovel and Steam", "Warm hands, warm hearts"],
  ],
  retrowave: [
    ["朝六時のネオン", "Neon at Six", "Rise and shine"],
    ["夜明け前の群れ", "Flock Before Dawn", "Before the sun"],
  ],
  kirie: [
    ["大雪の朝の切り紙", "Paper Morning, Heavy Snow", "Deep snow, deep thanks"],
    ["白い屋根の町", "Town of White Roofs", "Snow upon snow"],
  ],
  pixel: [
    ["五日目のドット", "Day Five, Pixel Perfect", "5 DAYS STREAK"],
    ["つづく朝のレベルアップ", "Level Up Mornings", "CONTINUE?"],
  ],
  eijin: [
    ["二色の群れ、ひとつの道", "Two Colors, One Path", "Together we dig"],
    ["湾岸ぽい朝の除雪", "Bayside Snow Morning", "Mixed crew, nice view"],
  ],
};

/** キーなしの名前（v1.23）: 話題があれば「話題 ＋ その時の事実」で組む。家とその時ごとに変わる */
const MOCK_FORMS: ((topic: string, n: number, hm: string, prop: string) => [string, string])[] = [
  (t, n, hm) => [`${t}、${hm}の${n}羽`, `${n} Birds at ${hm}`],
  (t, _n, hm, p) => [`${hm}、${t}の${p}`, `${t} at ${hm}`],
  (t, n, hm) => [`${hm}にひらく${t}`, `Opened by ${n} Birds at ${hm}`],
  (t, _n, hm, p) => [`${p}と${t}の${hm}`, `A ${hm} Morning Path`],
];

export function mockCardText(input: CardTextInput): CardText {
  const scene = buildScene(input);
  if (scene.topic) {
    const k = parseInt(scene.code, 16);
    const hm = input.completedAtJst.replace(/^0/, "");
    const [designName, designNameEn] = MOCK_FORMS[k % MOCK_FORMS.length](scene.topic, input.memberCount, hm, PROP_LABEL[scene.props[0]] ?? "スコップ");
    const flavor = NAMES[input.style][k % NAMES[input.style].length][2];
    return { designName: designName.slice(0, 16), designNameEn, flavor, ...cardSnow(input), scene };
  }
  const list = NAMES[input.style];
  const seed = Number(input.date.replace(/-/g, "")) + input.memberCount + input.level;
  const [designName, designNameEn, flavor] = list[seed % list.length];
  return { designName, designNameEn, flavor, ...cardSnow(input), scene };
}

export async function cardText(input: CardTextInput): Promise<CardText> {
  if (!hasClaudeKey()) return mockCardText(input);
  const snow = cardSnow(input);
  const res = await askJson({
    task:
      "ありがとうカードの文字を作ってください。designName は日本語 6〜12 文字で、その時の状況（時刻・人数・雪の量・雪質・チームの混成）が伝わる詩的だが分かりやすい名前。" +
      "designNameEn は英語の副題。flavor は絵の中に入れる英語のひとこと（5語まで）。数字は input にあるものだけ。" +
      "絵に重ねる「その時だけの場面」も選んでください: props は持ち物を2つ（shovel=スコップ・tea=お茶・lantern=ランタン・sled=そり・snowman=雪だるま・sand=砂まき）、" +
      "mood は雰囲気（calm=静か・lively=にぎやか・heroic=大仕事）、why は「なぜこの絵か」を40字まで（その時の事実だけ。名前は書かない）。空と雪の降り方はプログラムが事実から決める。" +
      "さらに、input.topics（今日の話題＝その時の時事）から1つ選んで topicLabel にそのまま入れ、designName にもその話題の気配を入れてください（topics が空なら topicLabel は空）。" +
      "motif は、その話題とこの家のその時（時刻・人数・雪・雰囲気）を合わせた、この1枚だけのオリジナルの挿絵です。採点表 cardArt の motif の規則に従い、120×120 の座標に図形を 12〜40 個並べて描きます。" +
      "使わない項目は 0 か空文字。色は #rrggbb。文字・人の顔・実在の人や会社のマークは描かない。タッチの名前: " +
      STYLE_NAME[input.style],
    input: { ...input, snowKg: snow.snowKg, snowKgComparison: snow.snowKgComparison, snowType: SNOW_TYPE_LABEL[input.snowType ?? "unknown"] },
    schema: CardTextSchema,
    effort: "medium",
  });
  const { props, mood, why, topicLabel, motif, ...text } = res;
  return { ...text, ...snow, scene: buildScene(input, { props, mood, why, topicLabel, motif }) };
}
