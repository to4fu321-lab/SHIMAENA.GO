// AI参加コンシェルジュ（spec v1.7）: LINE の自由な文（「何からすればいいか分からない」など）を読み、
// その人に開いている参加の方法（lib/concierge/options.ts が絞った候補）から1つを選んで、アプリの活動へ誘う。
// 会話は3往復まで。3往復目は必ず1つ選ぶ（コードで強制）。画像は Claude が「空・持ち物・ひとこと」を選び、プログラムが描く。
// 体調は判断しない。候補の外は選ばない。他人の家を依頼にしない。キーがないときは言葉の一覧で選ぶ。
import { z } from "zod";
import { BODY_WORDS, DANGER_WORDS, type ConciergeOption, type OptionId } from "../concierge/options";
import { MOTIVES, motivesFromText, SUMMARY_MAX, tidyMotives, type Motive } from "../concierge/profile";
import { isVoiceCategory, VOICE_CATEGORIES, VOICE_LABEL, type VoiceCategory } from "../voice/store";
import { CAPTION_MAX, cleanCaption, SKIES, type Sky } from "../line/you-image";
import { askJson, hasClaudeKey } from "./client";

/** 会話の往復の上限（spec v1.17: 上限なしに。コストの保険で 30。最後の往復は必ず1つ選ぶ） */
export const MAX_TURNS = 30;
export const REPLY_MAX = 140;

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
  /** この文に「求められていること」があれば1件（spec v1.17 声を貯める）。category: feature=機能の要望・confusion=分からない所・trouble=困りごと・praise=うれしい声・none=なし。text は要約40字（原文を写さない） */
  voice: z.object({ category: z.enum([...VOICE_CATEGORIES, "none"]), text: z.string() }),
  /** まだ選ばないとき、返事の下に出す小さなボタンの候補（options の id を 2〜3 つ。その人の文と方向に合うもの。recent にあるものは避けて、毎回ちがえる）。選んだときは空 */
  suggest: z.array(z.string()),
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
  /** 町のいまの天気（Open-Meteo）。now=雪・くもり・晴れ・不明、tempC=気温、snowNext24hCm=この先24時間の降雪、depthCm=いまの積雪（モデル）。取れなければ undefined */
  weather?: { now: "雪" | "くもり" | "晴れ" | "不明"; tempC?: number; snowNext24hCm?: number; depthCm?: number };
  /** これまでに分かっている方向と要約（spec v1.17）。なければ空 */
  profile: { motives: Motive[]; summary: string };
  /** 直前の往復で見せた候補の id（同じボタンばかりにならないように避ける） */
  recent?: string[];
  /** 雑談のときの話題のたね（日と往復で回る。毎回ちがう話になる） */
  topics?: string[];
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
  /** 貯める声（なければ undefined） */
  voice?: { category: VoiceCategory; text: string };
  /** まだ選ばないときの小さなボタン（2〜3つ。毎回ちがう） */
  suggest: ConciergeOption[];
}

/**
 * 雑談の話題のたね（11/6 本人の指摘「何を話しても同じになる」）。日と往復で回して、毎回ちがう話題を Claude に渡す。
 * 体調・医療の話題は入れない。
 */
export const SMALLTALK_TOPICS: { topic: string; line: string; question: string }[] = [
  { topic: "シマエナガの豆知識", line: "シマエナガは北海道にしかいない小鳥で、寒い日ほど羽をふくらませて丸くなるんだしま〜。", question: "見かけたこと、ありますか？" },
  { topic: "雪の名前（ぼた雪・粉雪・ざらめ雪）", line: "雪には名前があって、ふわふわの粉雪、重たいぼた雪、春のざらめ雪で、雪かきの大変さもぜんぜんちがうんだしま〜。", question: "どの雪がいちばん好きですか？" },
  { topic: "雪かきのコツ", line: "雪かきのコツは、雪を捨てる場所を先に決めて、少しずつすくうこと。ひざを使うと腰がらくだしま〜。", question: "スコップとスノーダンプ、どっち派ですか？" },
  { topic: "子どものころの雪の思い出を聞く", line: "雪の日って、子どものころはうれしかったしま〜。かまくらや雪だるま、よく作りましたか？", question: "いちばんの雪の思い出を教えてください。" },
  { topic: "寒い日のあったかい食べもの・飲みもの", line: "寒い日は、雪かきのあとのあったかい飲みものが最高だしま〜。", question: "あなたのあったまる一品は何ですか？" },
  { topic: "雪の朝の静かさ・きれいさ", line: "雪が積もった朝って、音が吸われて町がしんと静かになるんだしま〜。あの空気、好きです。", question: "朝の雪景色、見ますか？" },
  { topic: "ご近所のあいさつ・顔見知りが増える話", line: "雪かきのいいところは、ご近所と自然に「おはよう」が増えることだしま〜。", question: "最近、ご近所と話しましたか？" },
  { topic: "雪国の知恵（滑り止め・玄関前の砂）", line: "雪国の知恵で、玄関の前に砂をまいておくと、朝の凍った段差で転びにくくなるんだしま〜。", question: "家のまわりで、つるつるの所はありますか？" },
  { topic: "冬の星空・朝焼け", line: "冬は空気がすんでいて、星も朝焼けもきれいだしま〜。雪かきの前にちょっと空を見るのがおすすめです。", question: "朝型ですか、夜型ですか？" },
  { topic: "10分の雪かきの運動量", line: "雪かき10分は、けっこうな運動になるんだしま〜。冬の運動不足にちょうどいいです。", question: "冬は体を動かしていますか？" },
  { topic: "カードやチームのゲームの話", line: "シマエナGOでは、雪かきのたびにその時だけのカードが1枚届くんだしま〜。同じ絵は二度と出ません。", question: "集めるの、好きですか？" },
  { topic: "冬の鳥（ヒヨドリ・アカゲラ・カラ類）", line: "冬の町には、シマエナガのほかにもアカゲラやシジュウカラが来るんだしま〜。雪の上の足あとも楽しいです。", question: "庭や公園で鳥を見ますか？" },
  { topic: "雪どけの季節の楽しみ", line: "長い冬も、雪どけのころには福寿草が顔を出すんだしま〜。それまでみんなで乗り切りましょう。", question: "春になったら、まず何をしたいですか？" },
  { topic: "雪だるま・かまくら", line: "雪かきでできた雪の山で、小さな雪だるまを作るのが隊長の楽しみだしま〜。", question: "最後に雪だるまを作ったのは、いつですか？" },
  { topic: "除雪車と雪捨て場", line: "除雪車が通ったあと、玄関前に固い雪の壁ができるのが雪国あるあるだしま〜。あれは早めに崩すのがコツです。", question: "お宅の前にも、できますか？" },
  { topic: "町のいまの天気から今夜・明日の話", line: "いまの空から、今夜と明日の話をしましょうしま〜。", question: "明日の予定は、ありますか？" },
];

/** 今日・この往復の話題のたねを3つ（日と往復で回る） */
export function topicsFor(now: Date, turn: number): string[] {
  const day = Math.floor(now.getTime() / 86400000);
  const n = SMALLTALK_TOPICS.length;
  const start = (day * 5 + turn * 3) % n;
  return [0, 1, 2].map((i) => SMALLTALK_TOPICS[(start + i) % n].topic);
}

/** 雑談らしい文（質問でも相談でもない、話しかけ） */
export const SMALLTALK_WORDS = /話して|はなして|話そう|こんにちは|こんばんは|おはよう|おやすみ|ひま|暇|雑談|元気|げんき|つかれた|疲れた|きれい|楽しい|たのしい|ありがとう|おつかれ|好き|すき|何してる|なにしてる/;

/**
 * 小さなボタンの候補を選ぶ（Claude が選ばなかったとき・キーがないとき）。
 * 直前に見せたものは後ろに回し、往復ごとに始まりをずらして、同じ2つにならないようにする
 */
export function pickSuggest(options: ConciergeOption[], turn: number, recent: string[] = [], count = 3): ConciergeOption[] {
  if (options.length === 0) return [];
  const fresh = options.filter((o) => !recent.includes(o.id));
  const pool = fresh.length >= 2 ? fresh : options;
  const start = ((turn - 1) * count) % pool.length;
  const out: ConciergeOption[] = [];
  for (let i = 0; i < Math.min(count, pool.length); i++) out.push(pool[(start + i) % pool.length]);
  return out;
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
    // 雑談には、話題のたね（日と往復で回る）から1つ。相談らしい文には聞き返し
    const topic = SMALLTALK_WORDS.test(t) ? SMALLTALK_TOPICS.find((x) => x.topic === (input.topics ?? topicsFor(new Date(), input.turn))[0]) : undefined;
    const w = input.weather;
    const weatherLine = w && w.now !== "不明" ? `いまは${w.now}${w.tempC !== undefined ? `で${w.tempC}度` : ""}${w.snowNext24hCm !== undefined ? `、この先24時間の雪は${w.snowNext24hCm}cmの見こみ` : ""}です。` : "";
    const reply = topic
      ? input.role === "helper"
        ? topic.line
        : topic.line.replace(/だしま〜/g, "です").replace(/しま〜/g, "")
      : polite(input.role, "教えてくれてありがとうえな〜！", "教えてくださって、ありがとうございます。");
    return {
      reply: (topic && topic.topic.startsWith("町のいまの天気") && weatherLine ? `${weatherLine}${reply}` : reply).slice(0, REPLY_MAX),
      pick: null,
      question: topic ? topic.question : polite(input.role, "今日は外に出られそうですか？", "今日は、外に出られそうですか？"),
      caption: "あなたの出番を一緒に",
      sky,
      motives,
      why: null,
      summary: "",
      voice: mockVoice(input.text),
      suggest: pickSuggest(input.options as ConciergeOption[], input.turn, input.recent).map((o) => o.id),
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
    voice: mockVoice(input.text),
    suggest: [],
  };
}

/** 言葉の一覧で「声」の種類を読む。要約は原文を写さず、種類の名前だけ */
export function mockVoice(text: string): ConciergeAnswer["voice"] {
  const t = text.replace(/\s+/g, "");
  const category: VoiceCategory | "none" = /ほしい|欲しい|あったら|できたら|してほしい|追加|機能/.test(t)
    ? "feature"
    : /分からない|わからない|どこ|どうやって|やり方|何をすれば|なにをすれば|何から|使い方/.test(t)
      ? "confusion"
      : /できない|困|失敗|うまくいかない|動かない|押せない|届かない|出ない|にならない|されない|こない|消えた|止まった/.test(t)
        ? "trouble"
        : /ありがとう|楽しい|たのしい|うれしい|嬉しい|助かった|よかった/.test(t)
          ? "praise"
          : "none";
  return { category, text: category === "none" ? "" : `${VOICE_LABEL[category]}（言葉の一覧で分類）` };
}

const MOTIVE_WHY: Record<Motive, string> = { connect: "人とつながりたい気持ち", exercise: "体を動かしたい気持ち", community: "町の役に立ちたい気持ち", game: "ゲームとして楽しみたい気持ち" };

/** Claude の答えを、そのまま使ってよい形にそろえる（候補の外・長すぎ・体の話・3往復目の未選択を直す） */
export function tidyConcierge(a: ConciergeAnswer, input: ConciergeInput, options: ConciergeOption[]): ConciergeResult {
  let option = options.find((o) => o.id === a.pick) ?? null;
  if (!option && mustPick(input.turn)) option = options[0] ?? null; // 3往復に1回と最後の往復は、必ず1つすすめる
  let reply = (a.reply ?? "").replace(/\s+/g, " ").trim();
  const sentences = reply.match(/[^。！？!?]+[。！？!?]?/g) ?? [reply];
  reply = sentences.slice(0, 3).join("").slice(0, REPLY_MAX);
  if (!reply || BODY_WORDS.test(reply)) reply = mockConcierge(input).reply;
  const question = option ? null : (a.question ?? "").replace(/\s+/g, " ").trim().slice(0, 60) || "今日は、外に出られそうですか？";
  const caption = cleanCaption(a.caption, CAPTION_MAX) || "あなたの出番です";
  const sky = (SKIES as readonly string[]).includes(a.sky) ? a.sky : skyFor(input.hour, input.snowCm);
  const motives = tidyMotives(a.motives);
  let why = option ? (a.why ?? "").replace(/\s+/g, " ").trim().slice(0, 40) : "";
  if (BODY_WORDS.test(why)) why = "";
  let summary = (a.summary ?? "").replace(/\s+/g, " ").trim().slice(0, SUMMARY_MAX);
  if (BODY_WORDS.test(summary)) summary = ""; // 体のことは残さない
  const vt = (a.voice?.text ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  const voice = a.voice && isVoiceCategory(a.voice.category) && vt && !BODY_WORDS.test(vt) ? { category: a.voice.category, text: vt } : undefined;
  // 小さなボタン: Claude が選んだ候補のうち options にあるもの（重複なし・3つまで）。足りなければ回して足す
  let suggest: ConciergeOption[] = [];
  if (!option) {
    const ids = [...new Set(a.suggest ?? [])];
    suggest = ids.map((id) => options.find((o) => o.id === id)).filter((o): o is ConciergeOption => Boolean(o)).slice(0, 3);
    if (suggest.length < 2) {
      for (const o of pickSuggest(options, input.turn, [...(input.recent ?? []), ...suggest.map((x) => x.id)])) {
        if (suggest.length >= 3) break;
        if (!suggest.includes(o)) suggest.push(o);
      }
    }
  }
  return { reply, option, question, caption, sky, motives, ...(why ? { why } : {}), summary, ...(voice ? { voice } : {}), suggest };
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
  return { reply, option: pick, question: null, caption: "できることから一緒に", sky: skyFor(input.hour, input.snowCm), guarded: danger ? "danger" : "body", motives: [], summary: "", suggest: [] };
}

export async function askConcierge(input: ConciergeInput, options: ConciergeOption[]): Promise<ConciergeResult> {
  const guarded = guardedAnswer(input, options);
  if (guarded) return guarded;
  if (!hasClaudeKey()) return tidyConcierge(mockConcierge(input), input, options);
  try {
    const res = await askJson({
      task:
        "あなたは参加コンシェルジュとしてのシマエナ隊長です。隊長トークに届いた文を読み、採点表 concierge の規則で答えます。" +
        "いちばん大事なこと: reply では、まずその人の文そのものに答えてください（質問には答える・雑談には返す・気持ちは受け止める。決まり文句で質問を返さない）。" +
        "天気・雪の質問には weather（いまの天気・気温・この先24時間の降雪 snowNext24hCm・積雪 depthCm）の数字だけで答える（ないものは「分からない」と言う。作らない）。snowCm は今朝の点呼の予報で、0 は点呼なしの意味。" +
        "雪のない日は、家の中や近所でできること（コツを教える・応援・カード・見回り・なかま）をすすめる。そのうえで、その人に合う参加の方法を options の中から1つ選んでください。" +
        "雑談（「何か話して」「ひま」「こんにちは」など）には、topics の中から1つ（なるべく最初のもの）を使って、毎回ちがう話題で具体的に話し、最後に軽い質問を1つ。前の往復（history）と同じ話題・同じ言い回しは使わない。" +
        "pick を null にするときは suggest に、その人の文と方向に合う候補の id を 2〜3 つ（recent にあるものは避け、毎回ちがえる）。" +
        "voice: この文に「求められていること」（機能の要望・分からない所・困りごと・うれしい声）があれば category と要約 text（40字、原文を写さない）。なければ none。" +
        "まず、その人が何を求めているか（motives: connect=つながり・exercise=運動・community=地域貢献・game=ゲーム。複数可、読み取れなければ空）を読み取り、profile（これまでの方向と要約）も合わせて、options の motives が合うものを選びます。why はすすめる理由を1文（40字）。summary は求めていることの要約（40字。名前・体のこと・住所は書かない）。" +
        `いまは ${input.turn} 往復目です（上限 ${MAX_TURNS}）。何をしたいか分からないときは、pick を null にして question で1つだけ聞いてください。相談が雑談でもよい。ただし 3往復に1回は何か1つすすめる（${MAX_TURNS} 往復目は必ず選ぶ）。` +
        "reply は3文まで。input の数字（分・点）だけを使う。caption は画像に入れるその人へのひとこと（14字まで、名前は書かない）。sky は時刻と雪に合わせる。",
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
