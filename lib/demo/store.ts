// デモの保存先。DATABASE_URL があれば Neon の demo_state 表に JSON でまるごと置く。
// ない間はサーバーのメモリに持つ（開発用。Vercel ではリクエストごとに別のサーバーになるので DB が要る）。
import { DEMO_MORNING } from "../demo-morning";
import { hasDb, query } from "../db";
import type { DemoState } from "./flow";

const g = globalThis as { __shimaenaDemo?: DemoState };
const KEY = "current";

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

/** DB の不調（表がまだない・つながらない）は画面を止めず、メモリに退避して続ける。様子は /admin の「保存:」に出る */
function fallback(e: unknown): void {
  console.error("[demo/store] DB に保存できないのでメモリで続けます:", e instanceof Error ? e.message : e);
}

/** いまの状態を読む。DB に行がなければ見本の状態を入れて返す */
export async function loadDemo(): Promise<DemoState> {
  if (!hasDb()) {
    g.__shimaenaDemo ??= initial();
    return g.__shimaenaDemo;
  }
  try {
    const rows = await query<{ state: DemoState }>("select state from demo_state where key = $1", [KEY]);
    if (rows[0]) return rows[0].state;
    const s = initial();
    await saveDemo(s);
    return s;
  } catch (e) {
    fallback(e);
    g.__shimaenaDemo ??= initial();
    return g.__shimaenaDemo;
  }
}

export async function saveDemo(next: DemoState): Promise<void> {
  if (!hasDb()) {
    g.__shimaenaDemo = next;
    return;
  }
  try {
    await query(
      `insert into demo_state (key, state, updated_at) values ($1, $2::jsonb, now())
       on conflict (key) do update set state = excluded.state, updated_at = now()`,
      [KEY, JSON.stringify(next)],
    );
  } catch (e) {
    fallback(e);
    g.__shimaenaDemo = next;
  }
}

export async function resetToSample(): Promise<void> {
  await saveDemo(initial());
}
