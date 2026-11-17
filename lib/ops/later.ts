// 返事を返したあとで続ける仕事（spec v1.24: カードの絵を描く）。Next の after() を使う（Vercel では返事のあとも関数の時間内で動く）。
// リクエストの外（テスト・スクリプト）では、そのまま裏で動かす。
import { after } from "next/server";
import { outsideLock } from "./lock";
import { recordProblem } from "./problems";
import { keepWorld } from "../world";

export function runLater(label: string, fn: () => Promise<void>): void {
  // 鍵の中から頼まれても、返事のあとは鍵の外で動かす（中で withStateLock を取り直せるように）
  // 頼んだときの町（本番／サンプル）を覚えておき、返事のあとも同じ町で動かす（spec v1.70）
  const job = keepWorld(() => outsideLock(() => fn()).catch((e) => recordProblem(label, e)));
  try {
    after(job);
  } catch {
    void job();
  }
}
