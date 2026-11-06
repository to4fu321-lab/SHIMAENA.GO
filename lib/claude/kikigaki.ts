// 雪の聞き書き（spec v1.26・採点表 kikigaki）: 隊長が、頼む家の人の雪の思い出を聞き、お話にする。
// ・次の質問: 前の答えを受けて、短い相づち＋やさしい質問を1つ（聞き手として、話した人が主役）
// ・お話: 答えから、本人の語り口の短いお話と題名、絵にする場面
// キーがない・失敗したときは決まった質問と組み立てのお話（lib/kikigaki/core.ts）。どちらも名前・住所・体の話は点検で落とす。
import { z } from "zod";
import { MAX_TURNS, answered, fallbackQuestion, scrub, templateStory, tidyStory, type Turn } from "../kikigaki/core";
import { askJson, hasClaudeKey } from "./client";

const NextSchema = z.object({
  /** 前の答えへの短い相づち（30字まで。最初は空） */
  aizuchi: z.string(),
  /** 次の質問（50字まで）。もう十分なら空 */
  question: z.string(),
  done: z.boolean(),
});

const StorySchema = z.object({
  title: z.string(),
  story: z.string(),
  /** 絵にする場面（60字まで） */
  scene: z.string(),
});

export interface NextTurn {
  aizuchi: string;
  question?: string;
}

const RULES = "採点表 kikigaki の規則に従います。体調・病気・お金の話はしない・聞かない。名前・住所・電話は聞かない。";

/** 次に聞くこと。turns は今までのやりとり（最後の答えまで） */
export async function nextTurn(turns: Turn[]): Promise<NextTurn> {
  const fallback = (): NextTurn => ({ aizuchi: turns.length ? "ありがとうございます。" : "", question: fallbackQuestion(turns) });
  if (turns.length >= MAX_TURNS) return { aizuchi: "たくさん、ありがとうございました。", question: undefined };
  if (!hasClaudeKey()) return fallback();
  try {
    const res = await askJson({
      task:
        "あなたはシマエナ隊長として、雪かきを頼んだお年寄りから「雪の思い出」を聞き書きしています。" +
        "直前の答えを受けて、心のこもった短い相づち（aizuchi、30字まで、話の中の具体的なことばを1つ拾う）と、次の質問を1つ（question、50字まで）書いてください。" +
        "質問は、答えをもっと深くする（その時の音・におい・だれと・どんな気持ち）か、まだ聞いていない話題（子どものころの雪遊び・昔の雪かきの道具・雪の日の知恵・町の冬の景色・雪かきに来る人へのひとこと）へ。" +
        "やさしい、ゆっくりした「です・ます」。「しま〜」は使わない。はい／いいえで終わる質問にしない。" +
        `やりとりが ${MAX_TURNS} 回になる、または十分に話を聞けたら done=true で question は空。最初（turns が空）は aizuchi を空にして、答えやすい最初の質問を。` +
        RULES,
      input: { turns: turns.map((t) => ({ q: t.q, a: t.a || "（この質問はとばしました）" })), asked: turns.length, maxTurns: MAX_TURNS },
      schema: NextSchema,
      effort: "low",
    });
    const question = scrub(res.question, 60);
    if (res.done && answered(turns) >= 2) return { aizuchi: scrub(res.aizuchi, 40) || "たくさん、ありがとうございました。", question: undefined };
    return { aizuchi: scrub(res.aizuchi, 40), question: question || fallbackQuestion(turns) };
  } catch (e) {
    console.error("[kikigaki] 次の質問を作れませんでした（決まった質問にします）:", e instanceof Error ? e.message : e);
    return fallback();
  }
}

/** お話にする（題名・本文・絵の場面）。by は Claude が書いたか */
export async function writeStory(turns: Turn[]): Promise<{ title: string; story: string; scene: string; by: "claude" | "program" }> {
  const tpl = templateStory(turns);
  if (!hasClaudeKey()) return { ...tpl, scene: "", by: "program" };
  try {
    const res = await askJson({
      task:
        "聞き書きのやりとりから、その人が自分で語っているような短いお話を書いてください（本人の一人称、「わたし」。180〜240字）。" +
        "答えにあることだけを使い、作り話を足さない。音・色・手ざわりなど、答えの中の具体的なことばを大事に残す。最後は、雪かきに来てくれる人へのあたたかい一文で結ぶ（答えにあれば、その言葉で）。" +
        "title は 8〜14字の、お話の題名（例: かまくらの灯り・坂道とそりの冬）。scene は、このお話を絵本の1ページにするなら何を描くか（60字まで、人の名前なし）。" +
        "名前・地名・住所・会社名は「ご近所さん」「この町」などに言いかえる。" +
        RULES,
      input: { turns: turns.filter((t) => t.a.trim()).map((t) => ({ q: t.q, a: t.a })) },
      schema: StorySchema,
      effort: "medium",
    });
    return { ...tidyStory(res), scene: scrub(res.scene, 80), by: "claude" };
  } catch (e) {
    console.error("[kikigaki] お話を書けませんでした（組み立てにします）:", e instanceof Error ? e.message : e);
    return { ...tpl, scene: "", by: "program" };
  }
}
