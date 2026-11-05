// なかま機能の AI の文（spec v1.13・採点表 nakama）。書くのは文だけ。相手選び・同意・公開範囲はプログラム（lib/nakama/rules.ts）。
// 書き込みのとき（誘ったとき・バトンを渡したとき）だけ呼ぶ。点検に通らなければ決まった文に戻す。
import { z } from "zod";
import { askJson, hasClaudeKey } from "./client";
import { aiLineOk, templateInvite, templateStory, type Baton, type MeetKind, type MeetWindow } from "../nakama/rules";

const LineSchema = z.object({ text: z.string() });

export const INVITE_MAX = 45;
export const STORY_MAX = 70;

/** 合流の誘いの一文（相手の LINE と画面に出す）。名前は渡さない */
export async function meetupInviteLine(input: { kind: MeetKind; window: MeetWindow; baseNumber?: number; areaPeople: number }): Promise<string> {
  const fallback = templateInvite(input.kind, input.window, input.baseNumber);
  if (!hasClaudeKey()) return fallback;
  try {
    const res = await askJson({
      task:
        "雪かきの「ゆるく合流」の誘いを1文で書いてください。採点表 nakama の規則に従います: 45字まで、やさしい日本語、シマエナ隊長の明るい口調（名乗らない）。" +
        "kind は相手との関係（reunion=前回一緒だった仲間、welcome=初参加の人を迎える、senior=初参加の人へ経験者、new=はじめて会う近くの人、nearby=近くの人）。" +
        "window は時間（now10=今から10分以内、today=今日の都合のよい時間）。baseNumber があれば「地図の◯番の家」と書いてよい。" +
        "人の名前・家の場所・恋愛や気持ちの推測は書かない。断ってもよいことが伝わる、押しつけない言い方。入力にない数字は書かない。",
      input,
      schema: LineSchema,
      effort: "low",
      model: "light",
    });
    const allowed = [10, input.areaPeople, ...(input.baseNumber ? [input.baseNumber] : [])];
    return aiLineOk(res.text, INVITE_MAX, allowed) ? res.text.trim() : fallback;
  } catch (e) {
    console.error("[nakama] 誘いの文を書けませんでした:", e instanceof Error ? e.message : e);
    return fallback;
  }
}

/** バトンのつながりの一文（その地域の前のバトンと、今日の参加人数から） */
export async function batonStoryLine(input: { previous: Pick<Baton, "at" | "status" | "source">[]; now: string; areaPeople: number }): Promise<string> {
  const fallback = templateStory(input.previous, input.now, input.areaPeople);
  if (!hasClaudeKey()) return fallback;
  try {
    const facts = {
      previous: input.previous.map((b) => ({ hourJst: (new Date(b.at).getUTCHours() + 9) % 24, status: b.status, where: b.source })),
      nowHourJst: (new Date(input.now).getUTCHours() + 9) % 24,
      areaPeople: input.areaPeople,
    };
    const res = await askJson({
      task:
        "雪かきバトン（同じ地域で、時間をずらして雪かきをつなぐ）のつながりを1〜2文で書いてください。採点表 nakama の規則に従います: 70字まで、やさしい日本語。" +
        "例「朝の活動者がここまで雪かきをしました。午後のあなたがバトンを受け取りました。」。時刻は「朝・お昼・午後」で言い、数字の時刻は書かない。" +
        "使ってよい数字は areaPeople（今日この地域で参加した人数）だけ。人の名前・家の場所は書かない。",
      input: facts,
      schema: LineSchema,
      effort: "low",
      model: "light",
    });
    return aiLineOk(res.text, STORY_MAX, [input.areaPeople]) ? res.text.trim() : fallback;
  } catch (e) {
    console.error("[nakama] バトンの文を書けませんでした:", e instanceof Error ? e.message : e);
    return fallback;
  }
}
