// 今朝の先生（spec v1.6）: お願いする側の人が教えてくれた雪かきのコツ。朝をまたいで残す。
// 表を増やさず、morning_state の「town_tips」の行に JSON で置く（日付のキーとはぶつからない）。DB がなければメモリ。
import { hasDb, query } from "../db";
import { isDeployed } from "../env";

export interface Tip {
  id: string;
  participantId: string;
  /** 本人の言葉（60字まで）。名前は出さない */
  text: string;
  at: string; // ISO
}

const KEY = "town_tips";
const g = globalThis as { __shimaenaTips?: Tip[] };
export const TIP_MAX = 60;

export async function loadTips(): Promise<Tip[]> {
  if (hasDb()) {
    try {
      const rows = await query<{ state: { tips?: Tip[] } }>("select state from morning_state where key = $1", [KEY]);
      return rows[0]?.state.tips ?? [];
    } catch (e) {
      console.error("[tips] 読めないのでメモリで続けます:", e instanceof Error ? e.message : e);
    }
  }
  return g.__shimaenaTips ?? [];
}

async function saveTips(tips: Tip[]): Promise<void> {
  g.__shimaenaTips = tips;
  if (!hasDb()) return;
  try {
    await query(
      `insert into morning_state (key, state, updated_at) values ($1, $2::jsonb, now())
       on conflict (key) do update set state = excluded.state, updated_at = now()`,
      [KEY, JSON.stringify({ tips })],
    );
  } catch (e) {
    if (isDeployed()) throw e; // 公開環境では「保存できたように見えて消える」を避ける
    console.error("[tips] 保存できないのでメモリで続けます:", e instanceof Error ? e.message : e);
  }
}

/** 載せてよいコツか: 空でない・電話番号のような数字の並びや「〜さん」がない */
export function tipOk(text: string): boolean {
  const t = text.trim();
  return t.length >= 2 && !/\d{4,}|[0-9０-９-]{7,}|さん|様|番地|丁目/.test(t);
}

/** コツを1つ足す（同じ人は最新の5つまで）。載せられない文なら false */
export async function addTip(participantId: string, text: string, now = new Date()): Promise<boolean> {
  const t = [...text.trim()].slice(0, TIP_MAX).join("");
  if (!tipOk(t)) return false;
  const tips = await loadTips();
  const mine = tips.filter((x) => x.participantId === participantId);
  const others = tips.filter((x) => x.participantId !== participantId);
  const next = [...others, ...mine.slice(-4), { id: `tip-${now.getTime()}`, participantId, text: t, at: now.toISOString() }];
  await saveTips(next.slice(-200)); // 町全体で200まで
  return true;
}

/** その人が最後に教えてくれた日（なければ undefined） */
export async function lastTipAt(participantId: string): Promise<string | undefined> {
  return (await loadTips()).filter((x) => x.participantId === participantId).at(-1)?.at;
}
