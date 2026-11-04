// 隊長のひとこと（状態別、spec v1.6）を、朝に1回だけまとめて書く。短い文なので安いモデル。
// 数字は渡したもの（積雪・10分・15分・1軒）だけ。おかしい文は定型に戻す。
import { z } from "zod";
import { CAPTAIN_STATES, CAPTAIN_TEMPLATES, captainLineOk, type CaptainState } from "../captain";
import { askJson, hasClaudeKey } from "./client";

const CaptainSchema = z.object(Object.fromEntries(CAPTAIN_STATES.map((s) => [s, z.string()])) as Record<CaptainState, z.ZodString>);

export interface CaptainInput {
  snowCm: number;
  snowName?: string;
  safety: boolean;
}

const STATE_GUIDE: Record<CaptainState, string> = {
  safety: "大雪・低温・強風の朝。誰にでも。『ひとりでやらない』か『休む』を必ず入れる。丁寧語、語尾なし",
  requester: "雪かきをお願いする側（高齢の方も）。安心させる。丁寧語、語尾なし",
  almost_goal: "今朝の目標まであと1軒。10分だけでも、と誘う",
  first_done: "はじめての出撃を終えた人。ほめる",
  first: "はじめてアプリを開いた人。10分の見回りなど、小さな一歩を1つだけ",
  away: "3日以上来ていない人。責めない。休むのも大事、と言ってから小さな一歩",
  streak: "3日以上続けて来ている人。ありがとう。無理はさせない",
  normal: "ふだんの朝。今朝の雪に触れて、10分の出番に誘う",
};

/** 定型と同じ形で返す（キーがないときは定型そのまま） */
export async function captainLines(input: CaptainInput): Promise<Record<CaptainState, string>> {
  if (!hasClaudeKey()) return { ...CAPTAIN_TEMPLATES };
  const res = await askJson({
    task:
      "アプリのホームで、エナガ隊長が状態ごとにかける一言を書いてください。それぞれ1〜2文で24字まで・やさしい日本語。" +
      "語尾『しま〜』『えな〜』は、語尾を付けてよい状態だけ、1つまで。数字は input の積雪と、5・15・1 だけ使ってよい。" +
      "もっとやれ、とは言わない。名前は書かない。状態の説明:\n" +
      CAPTAIN_STATES.map((s) => `- ${s}: ${STATE_GUIDE[s]}`).join("\n"),
    input,
    schema: CaptainSchema,
    effort: "low",
    model: "light",
  });
  const allowed = [input.snowCm, 5, 15, 1];
  return Object.fromEntries(
    CAPTAIN_STATES.map((s) => [s, captainLineOk(s, res[s], allowed) ? res[s].trim() : CAPTAIN_TEMPLATES[s]]),
  ) as Record<CaptainState, string>;
}
