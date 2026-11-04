// あなたが主役の招待文（spec v1.6 → v1.8）: 雪かきを終えた人の、いまの本当の出来事から、友だちを誘う文を3案。
// v1.8: 3案は送る相手で分ける（友だちへ・家族へ・職場や学校の人へ）。材料に、どけた雪の kg・もらったカードの名前・
//       「ありがとう」の言葉・雪の名前を足す（ある時だけ）。名前・家・場所・拠点番号は書かない。数字は渡したものだけ。
// 短い文なので安いモデル。キーなし・おかしい文は定型。
import { z } from "zod";
import { askJson, hasClaudeKey } from "./client";

export const INVITE_MAX = 70;
export { INVITE_AUDIENCES } from "../invite-audiences";

export interface InviteInput {
  minutes: number;
  /** はじめての出撃か */
  firstTime: boolean;
  snowCm: number;
  snowName?: string;
  teamName?: string;
  /** v1.8: どけた雪（推定。ある時だけ） */
  snowKg?: number;
  /** v1.8: もらったカードの名前（ある時だけ） */
  cardName?: string;
  /** v1.8: 届いた「ありがとう」の言葉（ある時だけ） */
  thanks?: string;
  /** v1.8: ひとりで（ソロ出動・自分の家）か */
  solo?: boolean;
}

/** 定型の3案（友だちへ・家族へ・職場や学校の人へ） */
export function mockInvites(i: InviteInput): string[] {
  const what = i.solo ? "家の前の雪かき" : "近所の雪かき";
  const kg = i.snowKg && i.snowKg > 0 ? `${i.snowKg}kgの雪をどけた！` : "";
  const card = i.cardName ? `限定カード「${i.cardName}」ももらった。` : "";
  const thanks = i.thanks ? `「${i.thanks}」って言ってもらえた。` : "";
  return [
    `${i.minutes}分で${what}、${kg || "完了！"}${card}次の雪の日、一緒にやらない？⛄`,
    `${thanks || `今日は${what}をしてきたよ。`}みんなで雪かきする町の仕組み、見てみて。`,
    `${i.firstTime ? "はじめて" : ""}${what}アプリで町に参加中。${kg}10分からでOK、雪の日に一緒にどう？`,
  ];
}

/** 使ってよい文か: 長さ・名前や拠点を書いていない・数字は渡したものだけ */
export function inviteOk(text: string, allowed: number[]): boolean {
  const t = text.trim();
  if (t.length < 8 || [...t].length > INVITE_MAX) return false;
  if (/さん|様|拠点|番地|丁目/.test(t)) return false;
  return (t.match(/\d+/g) ?? []).map(Number).every((n) => allowed.includes(n));
}

/** 定型の文にも長さの決まりを守らせる（長ければ「。」で切る） */
function fit(t: string): string {
  if ([...t].length <= INVITE_MAX) return t;
  const cut = [...t].slice(0, INVITE_MAX).join("");
  const i = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("！"));
  return i > 10 ? cut.slice(0, i + 1) : cut;
}

export async function inviteDrafts(i: InviteInput): Promise<string[]> {
  const fallback = mockInvites(i).map(fit);
  if (!hasClaudeKey()) return fallback;
  try {
    const res = await askJson({
      task:
        `雪かきを終えたばかりの人が、誘う LINE の文を3案書いてください。本人の目線で、それぞれ${INVITE_MAX}字まで。` +
        "1案目は友だちへ（くだけた言い方）、2案目は家族へ（あたたかく）、3案目は職場・学校の人へ（ていねいに軽く）。" +
        "input の事実だけを使う（どけた雪の kg・カードの名前・ありがとうの言葉・雪の名前は、あるときだけ入れる）。人の名前・家・場所・拠点の番号は書かない。押しつけない。",
      input: i,
      schema: z.object({ drafts: z.array(z.string()) }),
      effort: "low",
      model: "light",
    });
    const allowed = [i.minutes, i.snowCm, 1, 10, ...(i.snowKg ? [i.snowKg] : [])];
    return [0, 1, 2].map((k) => (res.drafts[k] && inviteOk(res.drafts[k], allowed) ? res.drafts[k].trim() : fallback[k]));
  } catch (e) {
    console.error("[invite] Claude が使えないので定型にします:", e instanceof Error ? e.message : e);
    return fallback;
  }
}
