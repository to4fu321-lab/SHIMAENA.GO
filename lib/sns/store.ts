// Claude が書いた投稿文の置き場（spec v1.3）。今朝の状態（morning_state の current）とは別の行（key = 'share'）に置く。
// Claude を待つあいだに別の完了が保存されても、今朝の状態を古い内容で上書きしないため。
import { hasDb, query } from "../db";

export interface StoredShareText {
  text: string;
  /** 作ったときの数字（shareKey）。数字が変わっていたら使わない */
  key: string;
  at: string;
  byClaude: boolean;
}
export type StoredShareTexts = Partial<Record<string, StoredShareText>>;

const KEY = "share";
const g = globalThis as { __shimaenaShare?: StoredShareTexts };

export async function loadShareTexts(): Promise<StoredShareTexts> {
  if (!hasDb()) return g.__shimaenaShare ?? {};
  try {
    const rows = await query<{ state: StoredShareTexts }>("select state from morning_state where key = $1", [KEY]);
    return rows[0]?.state ?? {};
  } catch {
    return {};
  }
}

/** 1種類ぶんだけ書き足す（ほかの種類は消さない） */
export async function saveShareText(kind: string, entry: StoredShareText): Promise<void> {
  if (!hasDb()) {
    g.__shimaenaShare = { ...(g.__shimaenaShare ?? {}), [kind]: entry };
    return;
  }
  await query(
    `insert into morning_state (key, state, updated_at) values ($1, $2::jsonb, now())
     on conflict (key) do update set state = morning_state.state || excluded.state, updated_at = now()`,
    [KEY, JSON.stringify({ [kind]: entry })],
  );
}
