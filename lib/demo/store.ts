// デモの保存先。DATABASE_URL がない間はサーバーのメモリに持つ（開発・デモ用）。
// 注意: Vercel ではリクエストごとに別のサーバーになることがあるので、本番は Neon（T07）を使う。
import { DEMO_MORNING } from "../demo-morning";
import type { DemoState } from "./flow";

const g = globalThis as { __shimaenaDemo?: DemoState };

/** 最初は「朝 7:10 ごろの途中の状態」（地図を開いたとき見栄えがするように） */
function initial(): DemoState {
  return {
    morning: structuredClone(DEMO_MORNING),
    answers: [],
    messages: [],
    briefing: "今朝の予報は12cm。8軒を7:00から始めます。人手が足りない家が1軒あります。",
    clockMin: 7 * 60 + 10,
    log: ["デモの途中の状態から始めています"],
  };
}

export function getDemo(): DemoState {
  g.__shimaenaDemo ??= initial();
  return g.__shimaenaDemo;
}

export function setDemo(next: DemoState): void {
  g.__shimaenaDemo = next;
}

export function resetToSample(): void {
  g.__shimaenaDemo = initial();
}
