// ことばで答える・頼む（spec v1.6）: 点呼の時間に LINE へ送られたふつうの文を、点呼の答えと段取りに分ける。
// 例「10時に病院だから、9時までに玄関だけお願いできるかね」→ いいえ（来てほしい）・9:00 まで・玄関前。
// 体調の判断はしない（「病院」は予定として時刻だけ使う）。分からないときは聞き返す。キーがないときは言葉の一覧で読む。
import { z } from "zod";
import { AREA_LABEL, requestLabel } from "../request-note";
import { askJson, hasClaudeKey } from "./client";

export { AREA_LABEL, requestLabel };

export const WordsSchema = z.object({
  /** 点呼の答え。お願いする側: yes（出られる）／no（来てほしい）／together（一緒なら）。手伝う側: 0・5・15・30・60（分）。分からない: unknown */
  answer: z.enum(["yes", "no", "together", "0", "10", "20", "30", "60", "unknown"]),
  /** 締め切り "09:00"。言っていなければ null */
  deadline: z.string().nullable(),
  /** どこまで。言っていなければ null */
  area: z.enum(["entrance", "garage", "road"]).nullable(),
  /** 手伝う人に見せるひとこと（20字まで。名前・病名・体のことは書かない）。なければ null */
  note: z.string().nullable(),
  /** 分からないときの聞き返し（はい／いいえで答えられる一文）。分かったら null */
  askBack: z.string().nullable(),
});
export type Words = z.infer<typeof WordsSchema>;

export interface WordsInput {
  text: string;
  role: "requester" | "helper";
}


/** 体や病気のことばは、手伝う人へのひとことに入れない */
const BODY_WORDS = /病院|病気|通院|入院|薬|腰|膝|ひざ|足が|体調|具合|痛|熱|手術|リハビリ|血圧|心臓/;

/** "9時半" "9:30" "９時" → "09:30"。午後の言い方は12を足す */
function findTime(t: string): string | null {
  const m = /(午後|夕方)?\s*([0-9０-９]{1,2})\s*(?:時|:|：)\s*(半|[0-9０-９]{2})?/.exec(t);
  if (!m) return null;
  const toHalf = (x: string) => x.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  let h = Number(toHalf(m[2]));
  const min = m[3] === "半" ? 30 : m[3] ? Number(toHalf(m[3])) : 0;
  if (m[1] && h < 12) h += 12;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

/** 「9時までに」の時刻（締め切り）。「10時に病院」のような予定の時刻は締め切りにしない */
function findDeadline(t: string): string | null {
  const m = /([^、。]*?)(?:まで|迄)/.exec(t);
  return m ? findTime(m[1]) : null;
}

/** キーがないとき: 言葉の一覧で読む（小さく安全なほう。迷ったら聞き返す） */
export function mockWords(input: WordsInput): Words {
  const t = input.text.replace(/\s+/g, "");
  const deadline = findDeadline(t);
  const area = /道路|道まで|歩道/.test(t) ? "road" : /車庫|ガレージ|車/.test(t) ? "garage" : /玄関|入口|入り口|戸口/.test(t) ? "entrance" : null;
  const base = { deadline, area, note: null, askBack: null } as const;
  if (input.role === "helper") {
    if (/休|無理|行けない|いけない|ダメ|だめ/.test(t)) return { ...base, answer: "0", deadline: null, area: null };
    const n = /([0-9０-９]{1,2})\s*分/.exec(t)?.[1];
    const min = n ? Number(n.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))) : NaN;
    const pick = [10, 20, 30, 60].find((x) => min <= x);
    if (pick) return { ...base, answer: String(pick) as Words["answer"], deadline: null, area: null };
    if (/行ける|いける|行きます|大丈夫|OK|ok/.test(t)) return { ...base, answer: "20", deadline: null, area: null };
    return { ...base, answer: "unknown", deadline: null, area: null, askBack: "何分くらい動けそうですか？下のボタンから選んでください。" };
  }
  if (/一緒|いっしょ|手伝って|手伝います/.test(t)) return { ...base, answer: "together" };
  if (/お願い|おねがい|頼む|たのむ|来て|きて|助けて|出られない|出れない|無理/.test(t) || deadline || area) return { ...base, answer: "no" };
  if (/大丈夫|だいじょうぶ|出られる|出れる|平気|いらない|要らない|孫が|家族が|息子|娘/.test(t)) return { ...base, answer: "yes", deadline: null, area: null };
  return { ...base, answer: "unknown", askBack: "今朝、雪かきに来てほしいですか？下のボタンで「いいえ」を押すと、人が来ます。" };
}

/** Claude の答えを、そのまま使ってよい形にそろえる（体のことばは手伝う人へ出さない・時刻の形をそろえる） */
export function tidyWords(w: Words, role: WordsInput["role"]): Words {
  const deadline = w.deadline && /^\d{1,2}:\d{2}$/.test(w.deadline) ? w.deadline.padStart(5, "0") : null;
  const note = w.note && !BODY_WORDS.test(w.note) ? w.note.slice(0, 20) : null;
  if (role === "helper") return { ...w, deadline: null, area: null, note: null };
  return { ...w, deadline, note };
}

export async function readWords(input: WordsInput): Promise<Words> {
  if (!hasClaudeKey()) return mockWords(input);
  const res = await askJson({
    task:
      `LINE に送られた文から、今朝の点呼の答えと雪かきの段取りを取り出してください。送ったのは「${input.role === "requester" ? "雪かきをお願いする側" : "雪かきを手伝う側"}」の人です。` +
      "お願いする側の answer: 自分で出られる・来なくていい → yes、来てほしい → no、一緒ならやれる → together。手伝う側の answer: 動ける分（5・15・30・60 のうち、言った分以下で一番近いもの）、休む → 0。" +
      "言っていないことは推測で埋めず null か unknown にする。体調や病気の判断はしない（「病院」は予定として時刻だけ使う）。" +
      "deadline は「〜までに」の時刻だけ（24時間の HH:MM）。予定の時刻を締め切りにしない。note は手伝う人向けに20字まで、名前・病名・体のことは書かない。" +
      "answer が unknown のときだけ、askBack に、はい／いいえで答えられるやさしい聞き返しを1つ。",
    input: { text: input.text.slice(0, 300), role: input.role },
    schema: WordsSchema,
    effort: "low",
    model: "light", // 短い文なので速いモデル（11/11 本人の了承: 短い文の仕事は Haiku）
  });
  return tidyWords(res, input.role);
}
