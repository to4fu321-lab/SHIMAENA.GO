// あなたが主役の招待文（spec v1.6）: 雪かきを終えた人の今朝の本当の活動から、友だちを誘う文を3案。
// 名前・家・場所・拠点番号は書かない。数字は渡したものだけ。短い文なので安いモデル。キーなし・おかしい文は定型。
import { z } from "zod";
import { askJson, hasClaudeKey } from "./client";

export const INVITE_MAX = 70;

export interface InviteInput {
  minutes: number;
  /** はじめての出撃か */
  firstTime: boolean;
  snowCm: number;
  snowName?: string;
  teamName?: string;
}

export function mockInvites(i: InviteInput): string[] {
  return [
    `今朝、${i.minutes}分だけ近所の雪かきをしてきた。1軒の玄関が開いたよ。次の雪の朝、一緒にどう？⛄`,
    i.firstTime ? "はじめて町内の雪かきに出てみた。思ったより楽しかった！10分からでいいので、一緒にやらない？" : `雪${i.snowCm}cmの朝、町内のみんなで雪かき。10分からでいいから、次は一緒に！`,
    i.snowName ? `今朝の相手は『${i.snowName}』。チームで倒してきた！シマエナGO、10分から参加できるよ。` : "LINE で1分で参加できる雪かきの助け合い。10分だけでも町が変わるよ。一緒にどう？",
  ];
}

/** 使ってよい文か: 長さ・名前や拠点を書いていない・数字は渡したものだけ */
export function inviteOk(text: string, allowed: number[]): boolean {
  const t = text.trim();
  if (t.length < 8 || [...t].length > INVITE_MAX) return false;
  if (/さん|様|拠点|番地|丁目/.test(t)) return false;
  return (t.match(/\d+/g) ?? []).map(Number).every((n) => allowed.includes(n));
}

export async function inviteDrafts(i: InviteInput): Promise<string[]> {
  const fallback = mockInvites(i);
  if (!hasClaudeKey()) return fallback;
  const res = await askJson({
    task:
      `雪かきを終えたばかりの人が、友だちを誘う LINE の文を3案書いてください。本人の目線で、それぞれ${INVITE_MAX}字まで。` +
      "input の事実だけを使う。人の名前・家・場所・拠点の番号は書かない。押しつけない、やさしい言い方。3案は雰囲気を変える（うれしさ／気軽さ／ゲームっぽさ）。",
    input: i,
    schema: z.object({ drafts: z.array(z.string()) }),
    effort: "low",
    model: "light",
  });
  const allowed = [i.minutes, i.snowCm, 1, 10];
  return [0, 1, 2].map((k) => (res.drafts[k] && inviteOk(res.drafts[k], allowed) ? res.drafts[k].trim() : fallback[k]));
}
