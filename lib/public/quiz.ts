// シマエナ診断（spec v1.3）: 登録なしで遊べる5問 → 5タイプ。純粋な関数（画面でもサーバーでも使う）。
// 性格を決めつけず、「どの10分が向いているか」をすすめるだけ。
import type { TeamId } from "../types";

export type QuizType = "asa" | "yukikaki" | "ouen" | "kyujo" | "kotsu";
export type QuizAnswer = 0 | 1 | 2; // いいえ／どちらかというと／はい

export interface QuizQuestion {
  text: string;
  /** はい で大きく増えるタイプ（×2）と、少し増えるタイプ（×1） */
  main: QuizType;
  sub: QuizType;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  { text: "朝に強いほう？", main: "asa", sub: "kotsu" },
  { text: "誰かを応援するのが好き？", main: "ouen", sub: "kyujo" },
  { text: "コツコツ続けるタイプ？", main: "kotsu", sub: "yukikaki" },
  { text: "仲間と協力するのが好き？", main: "kyujo", sub: "ouen" },
  { text: "10分だけでも、すぐ動ける？", main: "yukikaki", sub: "asa" },
];

export const QUIZ_CHOICES: { label: string; value: QuizAnswer }[] = [
  { label: "はい", value: 2 },
  { label: "どちらかというと", value: 1 },
  { label: "いいえ", value: 0 },
];

export interface QuizTypeInfo {
  type: QuizType;
  name: string;
  /** 一行の説明 */
  catchphrase: string;
  description: string;
  /** おすすめのソロミッション（表示用） */
  mission: string;
  /** 耳あての色（赤と緑は使わない） */
  ear: TeamId | undefined;
}

export const QUIZ_TYPES: Record<QuizType, QuizTypeInfo> = {
  asa: { type: "asa", name: "朝活シマエナ", catchphrase: "早起きは、雪かきの味方。", description: "雪の朝いちばんに動ける人。7:30 までの完了で、レアなカードに出会えるかも。", mission: "雪の状況を見回る（10分）", ear: "salvia" },
  yukikaki: { type: "yukikaki", name: "雪かきシマエナ", catchphrase: "10分あれば、玄関ひとつ。", description: "考えるより先にスコップを持てる人。自分の家の雪かきから始めましょう。", mission: "自分の家の雪かき（10分）", ear: "marigold" },
  ouen: { type: "ouen", name: "応援シマエナ", catchphrase: "見守りと声かけで、町をあたためる。", description: "人の背中を押せる人。家の中からでも、町の様子を見て仲間を呼べます。", mission: "地域の状況を確認する（3分）", ear: undefined },
  kyujo: { type: "kyujo", name: "救助シマエナ", catchphrase: "あと1人の家へ、駆けつける。", description: "仲間と動くと力が出る人。人手が足りない家の、最後の1人になれます。", mission: "仲間が必要な家を確認する（10分）", ear: "lupinus" },
  kotsu: { type: "kotsu", name: "コツコツシマエナ", catchphrase: "毎日の10分が、連続記録になる。", description: "続けるのが得意な人。5日連続の出動で、ドット絵のカードが待っています。", mission: "雪の多い場所を報告する（10分）", ear: "salvia" },
};

const ORDER: QuizType[] = ["yukikaki", "kyujo", "asa", "ouen", "kotsu"];

export function isQuizType(s: string | undefined | null): s is QuizType {
  return Boolean(s && s in QUIZ_TYPES);
}

/** 5つの答えからタイプを決める（同点は固定の順。全部「いいえ」なら応援シマエナ） */
export function quizResult(answers: QuizAnswer[]): QuizType {
  const score: Record<QuizType, number> = { asa: 0, yukikaki: 0, ouen: 0, kyujo: 0, kotsu: 0 };
  QUIZ_QUESTIONS.forEach((q, i) => {
    const a = answers[i] ?? 0;
    score[q.main] += a * 2;
    score[q.sub] += a;
  });
  if (Object.values(score).every((v) => v === 0)) return "ouen";
  return ORDER.reduce((best, t) => (score[t] > score[best] ? t : best), ORDER[0]);
}
