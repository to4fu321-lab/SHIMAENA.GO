// AI参加コンシェルジュ（spec v1.7）: LINE の自由な文（「何からすればいいか分からない」など）を読み、
// その人に開いている参加の方法（lib/concierge/options.ts が絞った候補）から1つを選んで、アプリの活動へ誘う。
// 会話は3往復まで。3往復目は必ず1つ選ぶ（コードで強制）。画像は Claude が「空・持ち物・ひとこと」を選び、プログラムが描く。
// 体調は判断しない。候補の外は選ばない。他人の家を依頼にしない。キーがないときは言葉の一覧で選ぶ。
import { z } from "zod";
import { BODY_WORDS, DANGER_WORDS, type ConciergeOption, type OptionId } from "../concierge/options";
import { CAPTION_MAX, cleanCaption, SKIES, type Sky } from "../line/you-image";
import { askJson, hasClaudeKey } from "./client";

export const MAX_TURNS = 3;
export const REPLY_MAX = 90;

export const ConciergeSchema = z.object({
  /** 隊長の返事（2文まで） */
  reply: z.string(),
  /** 選んだ参加の方法の id（候補の中から）。まだ選べないなら null */
  pick: z.string().nullable(),
  /** 選べないときの聞き返し（はい／いいえか、短く答えられる一文）。選んだら null */
  question: z.string().nullable(),
  /** 画像に入れる、その人へのひとこと（14字まで） */
  caption: z.string(),
  /** 画像の空（時間と天気に合わせる） */
  sky: z.enum(SKIES),
});
export type ConciergeAnswer = z.infer<typeof ConciergeSchema>;

export interface ConciergeTurn {
  user: string;
  captain: string;
}

export interface ConciergeInput {
  /** 何往復目か（1〜3） */
  turn: number;
  role: "helper" | "requester";
  firstTime: boolean;
  snowCm: number;
  safety: boolean;
  /** 日本時間の時（空の色に使う） */
  hour: number;
  options: Pick<ConciergeOption, "id" | "title" | "minutes" | "points" | "about">[];
  history: ConciergeTurn[];
  text: string;
}

export interface ConciergeResult {
  reply: string;
  option: ConciergeOption | null;
  question: string | null;
  caption: string;
  sky: Sky;
  /** 体のことば・危ない作業のことばで、決まった返事にした */
  guarded?: "body" | "danger";
}

const polite = (role: ConciergeInput["role"], helper: string, requester: string) => (role === "helper" ? helper : requester);

function skyFor(hour: number, snowCm: number): Sky {
  if (hour < 6 || hour >= 18) return "night";
  if (snowCm >= 10) return "snowy";
  return hour < 8 ? "dawn" : "morning";
}

/** 言葉の一覧で選ぶ（キーがないとき・Claude が失敗したとき） */
export function mockConcierge(input: ConciergeInput): ConciergeAnswer {
  const t = input.text.replace(/\s+/g, "");
  const ids = input.options.map((o) => o.id);
  const has = (id: OptionId) => ids.includes(id);
  const sky = skyFor(input.hour, input.snowCm);
  const want = (...xs: OptionId[]) => xs.find(has) ?? null;
  let pick: OptionId | null = null;
  if (/行けない|いけない|無理|忙しい|仕事|学校|時間がない|外に出られない|出られない|寒い|今日は/.test(t)) pick = want("rollcall", "online", "cheer", "tip");
  else if (/教え|コツ|昔は|経験/.test(t)) pick = want("tip", "online");
  else if (/応援/.test(t)) pick = want("cheer", "online");
  else if (/手伝いたい|行ける|行きます|やりたい|助けたい|動ける/.test(t)) pick = want("my_mission", "join", "rollcall", "own_house", "patrol");
  else if (/分からない|わからない|何から|なにから|初めて|はじめて|どうすれば|何をすれば|なにをすれば|迷/.test(t)) pick = want("my_mission", "rollcall", "own_house", "patrol", "online", "tip");
  if (!pick && input.turn >= MAX_TURNS) pick = input.options[0]?.id ?? null;
  if (!pick) {
    return {
      reply: polite(input.role, "教えてくれてありがとうえな〜！", "教えてくださって、ありがとうございます。"),
      pick: null,
      question: polite(input.role, "今日は外に出られそうですか？", "今日は、外に出られそうですか？"),
      caption: "あなたの出番を一緒に",
      sky,
    };
  }
  const o = input.options.find((x) => x.id === pick)!;
  const first = input.firstTime ? polite(input.role, "はじめては、ここからで大丈夫しま〜。", "はじめては、ここからで大丈夫です。") : "";
  return {
    reply: `${first}${o.title}（${o.minutes}分）はどうですか？`.slice(0, REPLY_MAX),
    pick,
    question: null,
    caption: o.id === "own_house" ? "あなたの家から町が変わる" : o.id === "online" ? "家からでも参加できる" : "あなたの出番です",
    sky,
  };
}

/** Claude の答えを、そのまま使ってよい形にそろえる（候補の外・長すぎ・体の話・3往復目の未選択を直す） */
export function tidyConcierge(a: ConciergeAnswer, input: ConciergeInput, options: ConciergeOption[]): ConciergeResult {
  let option = options.find((o) => o.id === a.pick) ?? null;
  if (!option && input.turn >= MAX_TURNS) option = options[0] ?? null; // 3往復目は必ず1つ選んで終える
  let reply = (a.reply ?? "").replace(/\s+/g, " ").trim();
  const sentences = reply.match(/[^。！？!?]+[。！？!?]?/g) ?? [reply];
  reply = sentences.slice(0, 2).join("").slice(0, REPLY_MAX);
  if (!reply || BODY_WORDS.test(reply)) reply = mockConcierge(input).reply;
  const question = option ? null : (a.question ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || "今日は、外に出られそうですか？";
  const caption = cleanCaption(a.caption, CAPTION_MAX) || "あなたの出番です";
  const sky = (SKIES as readonly string[]).includes(a.sky) ? a.sky : skyFor(input.hour, input.snowCm);
  return { reply, option, question, caption, sky };
}

/** 体・危ない作業のことばには、Claude を呼ばずに決まった返事（体調は判断しない） */
export function guardedAnswer(input: ConciergeInput, options: ConciergeOption[]): ConciergeResult | null {
  const body = BODY_WORDS.test(input.text);
  const danger = DANGER_WORDS.test(input.text);
  if (!body && !danger) return null;
  const pick = options.find((o) => o.id === "rollcall") ?? options.find((o) => o.id === "online") ?? options.find((o) => o.id === "cheer") ?? null;
  const reply = danger
    ? "屋根の雪下ろしや脚立・除雪機の作業は、シマエナGO ではお願いしていません。無理をせず、できることから一緒にやりましょう。"
    : "無理はしないでくださいね。体のことは、ご家族やかかりつけの方に相談してください。";
  return { reply, option: pick, question: null, caption: "できることから一緒に", sky: skyFor(input.hour, input.snowCm), guarded: danger ? "danger" : "body" };
}

export async function askConcierge(input: ConciergeInput, options: ConciergeOption[]): Promise<ConciergeResult> {
  const guarded = guardedAnswer(input, options);
  if (guarded) return guarded;
  if (!hasClaudeKey()) return tidyConcierge(mockConcierge(input), input, options);
  try {
    const res = await askJson({
      task:
        "あなたは参加コンシェルジュとしてのエナガ隊長です。LINE に届いた文を読み、採点表 concierge の規則で、その人に合う参加の方法を options の中から1つ選んでください。" +
        `いまは ${MAX_TURNS} 往復のうち ${input.turn} 往復目です。何をしたいか分からないときだけ、pick を null にして question で1つだけ聞いてください（${MAX_TURNS} 往復目は必ず選ぶ）。` +
        "reply は2文まで。input の数字（分・点）だけを使う。caption は画像に入れるその人へのひとこと（14字まで、名前は書かない）。sky は時刻と雪に合わせる。",
      input,
      schema: ConciergeSchema,
      effort: "low",
    });
    return tidyConcierge(res, input, options);
  } catch (e) {
    console.error("[concierge] Claude が使えないので言葉の一覧で選びます:", e instanceof Error ? e.message : e);
    return tidyConcierge(mockConcierge(input), input, options);
  }
}
