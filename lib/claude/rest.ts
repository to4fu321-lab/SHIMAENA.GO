// 休みのひとこと（11/4 本人の指示「AI がその日の天候やその人の出動数で、休みながらと伝える」）。
// いまの天気・気温・風と、その人の今日の出動回数から、シマエナ隊長が1文だけ。短い文なので安いモデル。
// 体調・病気の判断はしない（「休みながら」「水分」「手袋」など段取りの話だけ）。数字は渡したものだけ。おかしい文は定型。
// 同じ条件（日付・回数・天気・時間帯）の文はサーバーのメモリで使い回す（開くたびに呼ばない）。
import { z } from "zod";
import { askJson, hasClaudeKey } from "./client";

export interface RestInput {
  /** 今日この人が動いた回数（ソロの活動・家の手伝い） */
  todayCount: number;
  weather: "snow" | "cloudy" | "clear";
  tempC?: number;
  windMs?: number;
  timeOfDay: "dawn" | "day" | "dusk" | "night";
  snowCm?: number;
}

export const REST_MAX = 34;
const NG = /病|体調|血圧|心臓|薬|診|痛|熱が|倒れ|死|救急|しま〜.*しま〜|えな〜.*えな〜/;

/** 定型（キーがないとき・Claude の文がおかしいとき） */
export function mockRestLine(i: RestInput): string {
  const t = i.tempC;
  if (i.todayCount >= 3) return `今日はもう${i.todayCount}回！あったかくして休むしま〜。`;
  if (t !== undefined && t <= -5) return "冷えるね。10分ごとに手を温めて休むえな〜。";
  if ((i.windMs ?? 0) >= 8) return "風が強いね。ひとりでやらず、休みながらね。";
  if (i.todayCount >= 1) return "おつかれさま。続けるなら、ひと息ついてからえな〜。";
  if (i.weather === "snow") return "雪の中は、10分ごとにひと休みしま〜。";
  return "むりせず、休みながら10分だけえな〜。";
}

/** 使ってよい一文か: 長さ・体のことばなし・数字は渡したものだけ */
export function restLineOk(line: string, i: RestInput): boolean {
  const t = line.trim();
  if (t.length === 0 || [...t].length > REST_MAX || NG.test(t)) return false;
  const allowed = [i.todayCount, 10, 15, 1, Math.round(i.tempC ?? 999), Math.abs(Math.round(i.tempC ?? 999)), Math.round(i.windMs ?? 999), i.snowCm ?? 999];
  return (t.match(/\d+/g) ?? []).map(Number).every((n) => allowed.includes(n));
}

const cache = globalThis as { __shimaenaRest?: Map<string, string> };

export async function restLine(date: string, i: RestInput): Promise<string> {
  const key = `${date}|${i.todayCount}|${i.weather}|${i.timeOfDay}|${Math.round((i.tempC ?? 0) / 3)}|${Math.round((i.windMs ?? 0) / 4)}`;
  const memo = (cache.__shimaenaRest ??= new Map());
  const hit = memo.get(key);
  if (hit) return hit;
  let line = mockRestLine(i);
  if (hasClaudeKey()) {
    try {
      const res = await Promise.race([
        askJson({
          task:
            "シマエナ隊長（シマエナガの隊長）として、雪かきをする人へ、いまの天気・気温・風と今日の出動回数をふまえて『休みながら』を伝える一文を書いてください。" +
            `${REST_MAX}字まで・やさしい日本語。語尾『しま〜』か『えな〜』を1つだけ。体調や病気のことは書かない・判断しない（休む・手を温める・水分・ひとりでやらない、の段取りだけ）。` +
            "もっとやれ、とは言わない。数字は input にあるものだけ使ってよい。名前は書かない。",
          input: i,
          schema: z.object({ line: z.string() }),
          effort: "low",
          model: "light",
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000)),
      ]);
      if (restLineOk(res.line, i)) line = res.line.trim();
    } catch (e) {
      console.error("[rest] 休みのひとことを書けませんでした（定型を使います）:", e instanceof Error ? e.message : e);
    }
  }
  memo.set(key, line);
  return line;
}
