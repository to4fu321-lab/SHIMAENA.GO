// 待つのは長くても数秒（11/15 本人「ゲームが始まったら10秒以上は待てない。希望は5秒」）。
// 時間のかかる仕事（Claude・外のサービス）は、決めた時間で待つのをやめて先に画面へ返し、残りは返事のあとで続ける。
// 続けた仕事が終わったら、隊長トークと端末への通知で知らせる（呼ぶ側の then で）。
import { runLater } from "./later";

/** 画面が待つ長さの目安（ミリ秒） */
export const WAIT_MS = 5000;

export type Within<T> = { done: true; value: T } | { done: false };

/**
 * job を ms まで待つ。間に合えば { done: true, value }。間に合わなければ { done: false } を返し、
 * job はそのまま裏で続ける（返事を返したあとも、サーバーが止めないように runLater に預ける）。later は終わったあとの仕事（通知など）。
 */
export async function within<T>(label: string, job: Promise<T>, ms = WAIT_MS, later?: (value: T) => Promise<void>): Promise<Within<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = Symbol("late");
  const r = await Promise.race([job, new Promise<typeof late>((ok) => (timer = setTimeout(() => ok(late), ms)))]);
  clearTimeout(timer);
  if (r !== late) return { done: true, value: r as T };
  runLater(label, async () => {
    const value = await job;
    if (later) await later(value);
  });
  return { done: false };
}
