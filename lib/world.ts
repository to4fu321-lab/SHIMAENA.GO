// 町は2つ（spec v1.70。11/17 本人「本番は実際の天気に対応したバージョンに。サンプルは、そのまま」）。
//   real（本番の町）   : LINE でログインした本物の人と、その家。本当の天気と時計で動く（Open-Meteo・前夜21時／朝6:30 の定期実行）。
//   demo（サンプルの町）: 架空の人（h1・r2 …）と架空の家。いつでも「雪が積もった朝」（今までどおり）。
// 「今朝の状態」（morning_state）も名簿も、町ごとに別。どちらの町の話かは、処理の入口で1回だけ決める:
//   画面とボタン → だれとして見ているか（worldOf）。定期実行 → 本番。デモの人えらび → サンプル。
// 決めていないとき（テスト・昔からの入口）は、今までと同じ「1つの町」として動く（記録はサンプルと同じ場所・名簿は全員）。
// だから、入口で決め忘れても、本番の町が架空の人で汚れることはない。
import type { AsyncLocalStorage } from "node:async_hooks";
import * as React from "react";
import { demoEnabled } from "./env";

export type World = "real" | "demo";

// このファイルは、ブラウザ側の画面からも（夜の決まりの文などを通して）読み込まれる。
// サーバーでだけ使える部品（AsyncLocalStorage・React の cache）は、あるときだけ使う。ブラウザでは、町は「決めていない」のまま。
const g = globalThis as { __shimaenaWorld?: AsyncLocalStorage<World> };
function store(): AsyncLocalStorage<World> | undefined {
  if (g.__shimaenaWorld) return g.__shimaenaWorld;
  if (typeof window !== "undefined" || typeof process === "undefined" || typeof process.getBuiltinModule !== "function") return undefined;
  const Als = process.getBuiltinModule("node:async_hooks")?.AsyncLocalStorage;
  return Als ? (g.__shimaenaWorld = new Als<World>()) : undefined;
}

/** 画面を1枚つくるあいだの置き場（部品ごとに別々に動いても、同じ町を見るように） */
const pageBox = typeof React.cache === "function" ? React.cache(() => ({ world: undefined as World | undefined })) : undefined;

function box(): { world: World | undefined } | undefined {
  try {
    return pageBox?.();
  } catch {
    return undefined;
  }
}

/** 架空の人の ID の形（lib/viewer.ts の isDemoViewer・lib/inbox/key.ts と同じ） */
const DEMO_ID = /^[hr]\d+$/;
export const isDemoId = (id: string | undefined | null): boolean => Boolean(id && DEMO_ID.test(id));

/** その人の町: 架空の人ならサンプル、それ以外（ログインした本人・だれでもない）は本番。デモを止めている間（DEMO_MODE=off）は本番だけ */
export function worldOf(viewerId: string | undefined | null): World {
  return isDemoId(viewerId) && demoEnabled() ? "demo" : "real";
}

/** いまの町。入口で決めていなければ undefined（今までどおりの1つの町） */
export function currentWorld(): World | undefined {
  return store()?.getStore() ?? box()?.world;
}

/** 本番の町として動いているか（本当の時計・本当の天気で決める） */
export function isRealWorld(): boolean {
  return currentWorld() === "real";
}

/**
 * ここから先（この画面・このボタンの処理）を、その町で動かす。画面の最初と、本人確認（trustedViewer）の最初に呼ぶ。
 * 最初の await より前に呼ぶこと（呼んだ側の続きにも効かせるため）。
 */
export function enterWorld(world: World): void {
  store()?.enterWith(world);
  const b = box();
  if (b) b.world = world;
}

/** fn を、その町で動かす（定期実行・デモの用意・返事のあとの仕事） */
export function inWorld<T>(world: World, fn: () => T): T {
  const als = store();
  return als ? als.run(world, fn) : fn();
}

/** いまの町を覚えて、あとで（返事を返したあとなど）同じ町で動かす */
export function keepWorld<A extends unknown[], T>(fn: (...args: A) => T): (...args: A) => T {
  const w = currentWorld();
  return w ? (...args) => inWorld(w, () => fn(...args)) : fn;
}
