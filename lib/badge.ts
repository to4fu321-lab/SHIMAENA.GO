// 雪かき中の印と今日の合言葉（spec v1.12、本人の指示「毎週色が変わるから参加の敷居が上がらない仕組みで」）。
// 腕章などの持ち物は使わない（参加のハードルを上げないため）。チームの色は毎週変わるので、スマホの画面で見せる。
// 合言葉は日付と鍵からプログラムが決める（AI は使わない）。手伝う人の画面と、依頼者・家族の LINE で同じ言葉になる。
import { createHmac } from "node:crypto";
import { isDeployed } from "./env";

/** 雪や冬のやさしい言葉（人名・地名・怖い語は入れない。声に出して言いやすい長さ） */
export const PASSWORDS = [
  "ゆきだるま", "こなゆき", "かまくら", "てぶくろ", "ながぐつ", "マフラー", "ゆきうさぎ", "こたつ",
  "みかん", "あまざけ", "おしるこ", "ゆたんぽ", "ストーブ", "ぼうし", "そり", "スコップ",
  "ゆきあかり", "ふゆぞら", "あさやけ", "ほしぞら", "ぼたゆき", "わたゆき", "ゆきげしき", "しろくま",
  "シマエナガ", "ふくろう", "きつね", "うさぎ", "まつぼっくり", "どんぐり", "ほっとミルク", "ココア",
  "やきいも", "おでん", "おもち", "ゆず", "カイロ", "ランタン", "ゆきみち", "ひだまり",
] as const;

/** 合言葉の鍵。公開環境で LINE_CHANNEL_SECRET がなければ作らない（公開リポジトリの仮の鍵だと誰でも分かってしまうため） */
function secret(): string | undefined {
  const s = process.env.LINE_CHANNEL_SECRET;
  if (s) return s;
  return isDeployed() ? undefined : "dev-only-secret";
}

/** その日（日本時間 YYYY-MM-DD）の合言葉。鍵がなければ undefined */
export function passwordOf(ymd: string): string | undefined {
  const key = secret();
  if (!key) return undefined;
  const n = createHmac("sha256", key).update(`badge:${ymd}`).digest().readUInt32BE(0);
  return PASSWORDS[n % PASSWORDS.length];
}

/** 依頼者・家族への「来る人のお知らせ」の文（1つの吹き出しに1つの話題） */
export function visitNoticeLines(teamLabel: string, password: string | undefined, forFamily: boolean): string[] {
  return [
    forFamily ? `ご家族の家に、${teamLabel}の人が雪かきに向かっています。☃️` : `${teamLabel}の人が、雪かきに向かっています。☃️`,
    password
      ? `来た人のスマホには、チームの色と今日の合言葉「${password}」が出ています。`
      : "来た人のスマホには、チームの色と「シマエナGO 雪かき中」の印が出ています。",
    "玄関は開けなくて大丈夫です。お金は一切かかりません。",
    "合言葉がちがう人や、お金の話をする人には、玄関を開けずに町内会か #9110（警察の相談窓口）へ。",
  ];
}
