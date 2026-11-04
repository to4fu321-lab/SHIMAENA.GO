// Webhook で届いたイベントを順に処理する。送り直し（同じ webhookEventId）は1回だけ。
// 今朝の状態は鍵を取ってから書き換える。失敗は /admin の「問題」に残し、他のイベントは止めない。
import { withStateLock } from "../ops/lock";
import { firstTime } from "../ops/once";
import { recordProblem } from "../ops/problems";
import { handleEvent } from "./handle";
import type { LineEvent } from "./types";

/** イベントを順に処理する */
export async function processEvents(events: LineEvent[]): Promise<number> {
  let handled = 0;
  for (const ev of events) {
    try {
      if (!(await firstTime(ev.webhookEventId))) continue; // 送り直しで2回目
      await withStateLock(`line:${ev.type}`, () => handleEvent(ev));
      handled++;
    } catch (e) {
      // 1件の失敗で他のイベントを止めない。運営者が気づけるよう /admin の「問題」に残す
      await recordProblem(`line/webhook ${ev.type}`, e);
    }
  }
  return handled;
}

