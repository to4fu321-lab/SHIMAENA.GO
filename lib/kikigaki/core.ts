// 雪の聞き書き（spec v1.26）: 頼む家の人に、隊長が雪の思い出を聞き、短いお話と絵にする。ここは AI を使わない部分。
// ・キーがないときの質問（やさしい順に5つ）と、答えから組み立てるお話
// ・名前・住所・電話・体のことを取り除く点検（お話に入れない。AI の答えにも同じ点検をかける）
// ・届けてよいか（本人が「届ける」を選んだときだけ）

/** 1問ぶんのやりとり。a が空なら「とばした」 */
export interface Turn {
  q: string;
  a: string;
}

/** 質問は多くて5つ。2つ答えたら、いつでもお話にできる */
export const MAX_TURNS = 5;
export const MIN_ANSWERS = 2;
export const ANSWER_MAX = 300;
export const TITLE_MAX = 16;
export const STORY_MAX = 260;

/** キーがないとき（と、Claude が質問を作れなかったとき）の質問 */
export const QUESTIONS = [
  "子どものころの雪の日で、いちばん覚えていることは何ですか？",
  "そのころの雪かきは、だれと、どんな道具でしていましたか？",
  "雪の日の、ちょっとした知恵やコツはありますか？",
  "この町の冬で、好きな景色や音はありますか？",
  "雪かきに来てくれる人たちに、ひとこと伝えるなら？",
];

export const OPENING = "こんにちは、シマエナ隊長です。今日は、あなたの雪の思い出を聞かせてください。ゆっくりで大丈夫です。";

/** 体や病気の話（お話には入れない。AI は体調の判断をしない） */
const HEALTH = /病院|病気|入院|手術|薬|痛|血圧|認知|介護|骨折|怪我|けが|ケガ|具合|通院|リハビリ|亡くな|死/;
/** 家族や近所を指すことば（名前ではないので残す） */
const KIN = /^(お?(母|父|兄|姉|爺|婆|祖母|祖父|嫁|婿)|お隣|隣|近所|奥|おじい|おばあ|じい|ばあ|かあ|とう|にい|ねえ|みんな)/;

/** 名前・住所・電話・郵便番号・メールを取り除き、体の話の文を落とす。長さもそろえる */
export function scrub(text: string, max = ANSWER_MAX): string {
  let t = (text ?? "").replace(/\s+/g, " ").trim();
  t = t
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "")
    .replace(/\d{2,4}[-ー－]\d{2,4}[-ー－]\d{3,4}/g, "")
    .replace(/〒?\s?\d{3}-?\d{4}/g, "")
    .replace(/\d{10,11}/g, "")
    .replace(/[一-龥ぁ-んァ-ヶ\d０-９]{1,8}(丁目|番地|番|号棟|号)\s?[\d０-９-]*/g, "")
    .replace(/([一-龥ァ-ヶ]{1,4})(さん|ちゃん|くん|君|様|先生)/g, (m, name: string) => (KIN.test(name) ? m : "ご近所さん"));
  const kept = t
    .split(/(?<=[。！？!?])/)
    .filter((s) => s.trim() && !HEALTH.test(s))
    .join("");
  return [...kept].slice(0, max).join("").trim();
}

/** 答えのある数 */
export const answered = (turns: Turn[]) => turns.filter((t) => t.a.trim()).length;

/** キーなしの次の質問（まだ聞いていないもの）。もうなければ undefined */
export function fallbackQuestion(turns: Turn[]): string | undefined {
  if (turns.length >= MAX_TURNS) return undefined;
  return QUESTIONS.find((q) => !turns.some((t) => t.q === q));
}

/** 答えのことばから、絵の手がかり（キーなしの絵と題名に使う） */
export type Motif = "sled" | "kamakura" | "snowman" | "shovel" | "roof" | "snowball" | "town";
const MOTIF_WORDS: [Motif, RegExp][] = [
  ["kamakura", /かまくら|雪洞/],
  ["sled", /そり|ソリ|橇|すべり|滑り/],
  ["snowman", /雪だるま|雪ダルマ/],
  ["roof", /屋根|雪おろし|雪下ろし|つらら/],
  ["snowball", /雪合戦|雪玉/],
  ["shovel", /スコップ|スノーダンプ|ママさんダンプ|雪かき|除雪/],
];

export function motifsOf(turns: Turn[]): Motif[] {
  const all = turns.map((t) => t.a).join(" ");
  const found = MOTIF_WORDS.filter(([, re]) => re.test(all)).map(([m]) => m);
  return found.length ? found : ["town"];
}

const TITLES: Record<Motif, string> = {
  kamakura: "かまくらの灯り",
  sled: "坂道とそりの冬",
  snowman: "雪だるまの朝",
  roof: "屋根の雪と、つらら",
  snowball: "雪合戦の帰り道",
  shovel: "スコップの音の朝",
  town: "白い朝の思い出",
};

const trimEnd = (s: string) => s.replace(/[。．.!！?？、,\s]+$/, "");

/** キーなしのお話: 答えをつないで、本人の語りにする（とばした質問は使わない） */
export function templateStory(turns: Turn[]): { title: string; story: string } {
  const a = (i: number) => trimEnd(scrub(turns.find((t) => t.q === QUESTIONS[i])?.a ?? "", 90));
  const free = turns.filter((t) => !QUESTIONS.includes(t.q)).map((t) => trimEnd(scrub(t.a, 90))).filter(Boolean);
  const parts = [
    a(0) && `子どものころの雪の日といえば、${a(0)}。`,
    a(1) && `雪かきは、${a(1)}。`,
    a(2) && `雪の日のコツは、${a(2)}。`,
    a(3) && `この町の冬は、${a(3)}。`,
    ...free.map((f) => `${f}。`),
    a(4) && `雪かきに来てくれる人へ。${a(4)}。`,
  ].filter(Boolean) as string[];
  const story = [...(parts.join("") || "雪の朝のことを、少しだけ話しました。")].slice(0, STORY_MAX).join("");
  return { title: TITLES[motifsOf(turns)[0]], story };
}

/** Claude の書いた題名とお話にも同じ点検をかける */
export function tidyStory(s: { title: string; story: string }): { title: string; story: string } {
  const title = [...scrub(s.title, TITLE_MAX).replace(/[「」『』]/g, "")].slice(0, TITLE_MAX).join("") || "雪の思い出";
  const story = scrub(s.story, STORY_MAX) || "雪の朝のことを、少しだけ話しました。";
  return { title, story };
}

/** 届けてよいか: 本人が「届ける」を選び、その家（ミッション）にまだ届けていないときだけ */
export function shouldDeliver(story: { share: boolean; delivered: string[] } | undefined, missionId: string): boolean {
  return Boolean(story?.share) && !story!.delivered.includes(missionId);
}

/** 画面から来たやりとりを信じすぎない（数と長さをそろえる） */
export function normalizeTurns(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_TURNS).flatMap((t) => {
    if (!t || typeof t !== "object") return [];
    const q = String((t as Turn).q ?? "").slice(0, 120);
    const a = String((t as Turn).a ?? "").slice(0, ANSWER_MAX);
    return q ? [{ q, a }] : [];
  });
}
