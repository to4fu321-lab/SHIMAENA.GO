// AI参加コンシェルジュ（spec v1.7）: LINE の自由な文（「何からすればいいか分からない」など）を読み、
// その人に開いている参加の方法（lib/concierge/options.ts が絞った候補）から1つを選んで、アプリの活動へ誘う。
// 会話は3往復まで。3往復目は必ず1つ選ぶ（コードで強制）。画像は Claude が「空・持ち物・ひとこと」を選び、プログラムが描く。
// 体調は判断しない。候補の外は選ばない。他人の家を依頼にしない。キーがないときは言葉の一覧で選ぶ。
import { z } from "zod";
import { BODY_WORDS, DANGER_WORDS, type ConciergeOption, type OptionId } from "../concierge/options";
import { MOTIVES, motivesFromText, SUMMARY_MAX, tidyMotives, type Motive } from "../concierge/profile";
import { CAPTION_MAX, cleanCaption, SKIES, type Sky } from "../line/you-image";
import { askJson, hasClaudeKey } from "./client";

/** 会話の往復の上限（spec v1.17: 上限なしに。コストの保険で 30。最後の往復は必ず1つ選ぶ） */
export const MAX_TURNS = 30;
export const REPLY_MAX = 90;

/** この往復では必ず1つすすめるか（3往復に1回と、上限の往復。聞き返すだけで終わらないように） */
export function mustPick(turn: number): boolean {
  return turn >= MAX_TURNS || (turn > 0 && turn % 3 === 0);
}

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
  /** 文から読み取れた、その人が求めている方向（spec v1.17: connect=つながり・exercise=運動・community=地域貢献・game=ゲーム）。読み取れなければ空 */
  motives: z.array(z.enum(MOTIVES)),
  /** すすめる理由（1文、40字まで。その人の方向や状況に結びつける）。選ばないときは null */
  why: z.string().nullable(),
  /** その人が求めていることの要約（40字まで。名前・体のこと・住所は書かない）。読み取れなければ空 */
  summary: z.string(),
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
  options: Pick<ConciergeOption, "id" | "title" | "minutes" | "points" | "about" | "motives">[];
  history: ConciergeTurn[];
  text: string;
  /** これまでに分かっている方向と要約（spec v1.17）。なければ空 */
  profile: { motives: Motive[]; summary: string };
}

export interface ConciergeResult {
  reply: string;
  option: ConciergeOption | null;
  question: string | null;
  caption: string;
  sky: Sky;
  /** 体のことば・危ない作業のことばで、決まった返事にした */
  guarded?: "body" | "danger";
  /** 今回の文から読み取れた方向（空なら前のまま） */
  motives: Motive[];
  /** すすめる理由（1文）。なければ undefined */
  why?: string;
  /** 求めていることの要約（空なら前のまま） */
  summary: string;
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
  const motives = motivesFromText(input.text);
  const all = [...motives, ...input.profile.motives];
  let pick: OptionId | null = null;
  if (/行けない|いけない|無理|忙しい|仕事|学校|時間がない|外に出られない|出られない|寒い|今日は/.test(t)) pick = want("rollcall", "online", "cheer", "tip");
  else if (all.includes("connect")) pick = want("nakama", "join", "baton", "tip");
  else if (all.includes("game")) pick = want("own_house", "team", "cards");
  else if (all.includes("exercise")) pick = want("join", "own_house", "patrol");
  else if (all.includes("community")) pick = want("join", "patrol", "tip", "cheer", "own_house");
  else if (/教え|コツ|昔は|経験/.test(t)) pick = want("tip", "online");
  else if (/応援/.test(t)) pick = want("cheer", "online");
  else if (/手伝いたい|行ける|行きます|やりたい|助けたい|動ける/.test(t)) pick = want("my_mission", "join", "rollcall", "own_house", "patrol");
  else if (/分からない|わからない|何から|なにから|初めて|はじめて|どうすれば|何をすれば|なにをすれば|迷/.test(t)) pick = want("my_mission", "rollcall", "own_house", "patrol", "online", "tip");
  if (!pick && mustPick(input.turn)) pick = input.options[0]?.id ?? null;
  if (!pick) {
    return {
      reply: polite(input.role, "教えてくれてありがとうえな〜！", "教えてくださって、ありがとうございます。"),
      pick: null,
      question: polite(input.role, "今日は外に出られそうですか？", "今日は、外に出られそうですか？"),
      caption: "あなたの出番を一緒に",
      sky,
      motives,
      why: null,
      summary: "",
    };
  }
  const o = input.options.find((x) => x.id === pick)!;
  const why = all.length > 0 ? `${MOTIVE_WHY[all[0]]}にぴったりです。` : null;
  const first = input.firstTime ? polite(input.role, "はじめては、ここからで大丈夫しま〜。", "はじめては、ここからで大丈夫です。") : "";
  return {
    reply: `${first}${o.title}（${o.minutes}分）はどうですか？`.slice(0, REPLY_MAX),
    pick,
    question: null,
    caption: o.id === "own_house" ? "あなたの家から町が変わる" : o.id === "online" ? "家からでも参加できる" : o.id === "nakama" ? "ひとりじゃない10分" : "あなたの出番です",
    sky,
    motives,
    why,
    summary: "",
  };
}

const MOTIVE_WHY: Record<Motive, string> = { connect: "人とつながりたい気持ち", exercise: "体を動かしたい気持ち", community: "町の役に立ちたい気持ち", game: "ゲームとして楽しみたい気持ち" };

/** Claude の答えを、そのまま使ってよい形にそろえる（候補の外・長すぎ・体の話・3往復目の未選択を直す） */
export function tidyConcierge(a: ConciergeAnswer, input: ConciergeInput, options: ConciergeOption[]): ConciergeResult {
  let option = options.find((o) => o.id === a.pick) ?? null;
  if (!option && mustPick(input.turn)) option = options[0] ?? null; // 3往復に1回と最後の往復は、必ず1つすすめる
  let reply = (a.reply ?? "").replace(/\s+/g, " ").trim();
  const sentences = reply.match(/[^。！？!?]+[。！？!?]?/g) ?? [reply];
  reply = sentences.slice(0, 2).join("").slice(0, REPLY_MAX);
  if (!reply || BODY_WORDS.test(reply)) reply = mockConcierge(input).reply;
  const question = option ? null : (a.question ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || "今日は、外に出られそうですか？";
  const caption = cleanCaption(a.caption, CAPTION_MAX) || "あなたの出番です";
  const sky = (SKIES as readonly string[]).includes(a.sky) ? a.sky : skyFor(input.hour, input.snowCm);
  const motives = tidyMotives(a.motives);
  let why = option ? (a.why ?? "").replace(/\s+/g, " ").trim().slice(0, 40) : "";
  if (BODY_WORDS.test(why)) why = "";
  let summary = (a.summary ?? "").replace(/\s+/g, " ").trim().slice(0, SUMMARY_MAX);
  if (BODY_WORDS.test(summary)) summary = ""; // 体のことは残さない
  return { reply, option, question, caption, sky, motives, ...(why ? { why } : {}), summary };
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
  return { reply, option: pick, question: null, caption: "できることから一緒に", sky: skyFor(input.hour, input.snowCm), guarded: danger ? "danger" : "body", motives: [], summary: "" };
}

export async function askConcierge(input: ConciergeInput, options: ConciergeOption[]): Promise<ConciergeResult> {
  const guarded = guardedAnswer(input, options);
  if (guarded) return guarded;
  if (!hasClaudeKey()) return tidyConcierge(mockConcierge(input), input, options);
  try {
    const res = await askJson({
      task:
        "あなたは参加コンシェルジュとしてのシマエナ隊長です。隊長トークに届いた文を読み、採点表 concierge の規則で、その人に合う参加の方法を options の中から1つ選んでください。" +
        "まず、その人が何を求めているか（motives: connect=つながり・exercise=運動・community=地域貢献・game=ゲーム。複数可、読み取れなければ空）を読み取り、profile（これまでの方向と要約）も合わせて、options の motives が合うものを選びます。why はすすめる理由を1文（40字）。summary は求めていることの要約（40字。名前・体のこと・住所は書かない）。" +
        `いまは ${input.turn} 往復目です（上限 ${MAX_TURNS}）。何をしたいか分からないときは、pick を null にして question で1つだけ聞いてください。相談が雑談でもよい。ただし 3往復に1回は何か1つすすめる（${MAX_TURNS} 往復目は必ず選ぶ）。` +
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
