// 1回のリクエスト（画面を1枚つくる・ボタンを1回押す）のあいだだけ生きる置き場（11/7 本人の指摘「画面移行の読み込みが長い」）。
// ホームやソロの画面は、今朝の状態（morning_state）や名簿を部品ごとに何度も読んでいて、そのたびに Neon へ往復していた。
// React の cache() はリクエストごとに別の Map をくれるので、同じ読みは1回で済む。
// 書き込みのあとは消す（同じリクエストの中で読み直したとき、古いものを返さないように）。リクエストの外（裏の仕事・テスト）では毎回新しい Map になる＝何もしないのと同じ。
import { cache } from "react";

const boxes = cache(() => new Map<string, Promise<unknown>>());

function box(): Map<string, Promise<unknown>> | undefined {
  try {
    return boxes();
  } catch {
    return undefined;
  }
}

/** key の読みが同じリクエストの中で済んでいればそれを、なければ load() を1回だけ動かして覚える */
export function memoRead<T>(key: string, load: () => Promise<T>): Promise<T> {
  const b = box();
  if (!b) return load();
  const hit = b.get(key) as Promise<T> | undefined;
  if (hit) return hit;
  const p = load();
  b.set(key, p);
  // 失敗したら覚えない（次の読みでもう一度試す）
  p.catch(() => b.delete(key));
  return p;
}

/** 覚えたものを置き換える（保存したばかりの値を、同じリクエストの読みに返す） */
export function memoPut<T>(key: string, value: T): void {
  box()?.set(key, Promise.resolve(value));
}

/** 覚えたものを消す。prefix を渡せばその始まりのものだけ、なければ全部 */
export function memoClear(prefix?: string): void {
  const b = box();
  if (!b) return;
  if (prefix === undefined) {
    b.clear();
    return;
  }
  for (const k of [...b.keys()]) if (k.startsWith(prefix)) b.delete(k);
}
