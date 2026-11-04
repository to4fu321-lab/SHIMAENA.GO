// 「隊長に相談」の入口とよくある質問（spec v1.10）。決まった答えはプログラムで返す（AI は使わない）。
// ふつうの文は今までどおりコンシェルジュ（run.ts）へ。どれも返信なので、LINE の月の通数は使わない。
import type { LineMessage } from "../line/types";
import { MSG } from "../line/messages";
import { loadMorning } from "../morning/store";
import { appToday } from "../morning/today";
import { repo } from "../repo";
import { safetyLine } from "../safety";
import { currentWeather, weatherOf, type CurrentWeather } from "../sky";
import { TOWN } from "../town";

/** よくある質問のボタンの文字（押すとこの文字がそのまま届く） */
export const FAQ = {
  what: "何をすればいい？",
  snow: "今日の雪は？",
  team: "チームの様子",
  guide: "使い方",
} as const;

export type FaqKind = "start" | "snow" | "team" | "guide";

/** 届いた文が「隊長に相談」かよくある質問なら、その種類。「何をすればいい？」はコンシェルジュに任せるので入れない */
export function faqKind(text: string): FaqKind | null {
  const t = text.trim().replace(/[?？!！。]+$/, "");
  if (/^(隊長に相談|隊長に相談する|相談|相談したい)$/.test(t)) return "start";
  if (/^(今日の雪は|今日の雪|きょうの雪は|天気は|今日の天気は)$/.test(t)) return "snow";
  if (/^(チームの様子|チームは|わたしのチーム|私のチーム)$/.test(t)) return "team";
  if (/^(使い方|つかいかた|使いかた)$/.test(t)) return "guide";
  return null;
}

/** 今日の雪の答え（雪の朝なら予報、ちがえば今の天気）。数字は予報と Open-Meteo のものだけ */
export async function snowLines(now = new Date(), weather?: CurrentWeather): Promise<string[]> {
  const record = await loadMorning();
  const rc = record.morning.rollcall;
  const isToday = rc.date === appToday(record, now);
  if (isToday && rc.status !== "closed" && rc.forecastCm > 0) {
    const safety = safetyLine({ cm: rc.forecastCm, tempMinC: rc.tempMinC, windMaxMs: rc.windMaxMs });
    return [`今日の雪は ${rc.forecastCm}cm の予報です${rc.snowName ? `（${rc.snowName}）` : ""}。`, safety ?? "6時から19時まで、いつでも10分から手伝えます。"];
  }
  const w = weather ?? (await currentWeather(TOWN.center));
  const sky = weatherOf(w.code);
  const now1 = sky === "snow" ? "いま、雪が降っています" : sky === "clear" ? "いまは晴れています" : "いまはくもりです";
  const temp = w.tempC !== undefined ? `（${Math.round(w.tempC)}℃）` : "";
  return [`${now1}${temp}。`, "今日は雪かきの予定はありません。雪の前の晩 21時に、予報を見てお知らせします。"];
}

/** 「隊長に相談」とよくある質問への返事。登録していない人は登録の案内 */
export async function faqReply(lineUserId: string, kind: FaqKind, now = new Date()): Promise<LineMessage[]> {
  const p = await repo().findParticipantByLineUserId(lineUserId);
  if (kind === "start") return MSG.consultStart(Boolean(p));
  if (kind === "guide") return MSG.consultGuide();
  if (kind === "snow") return MSG.consultSnow(await snowLines(now));
  if (!p) return MSG.notRegistered();
  return MSG.consultTeam(Boolean(p.teamId));
}
