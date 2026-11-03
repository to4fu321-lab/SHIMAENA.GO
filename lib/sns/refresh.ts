// 投稿文を作り直す（書き込みのときだけ呼ぶ。画面を開くたびには Claude を呼ばない）。
import { hasClaudeKey } from "../claude/client";
import { shareKey, shareText, TOWN_SHARE_KINDS, type TownShareKind } from "../claude/share";
import { loadPublicStats } from "../public/load";
import type { PublicStats } from "../public/stats";
import { loadShareTexts, saveShareText } from "./store";
import { mockShareText } from "./text";

/** 数字が変わった種類だけ Claude に書いてもらい、保存する。キーがなければ何もしない（画面は定型を出す） */
export async function refreshShareTexts(now = new Date(), opts: { force?: boolean } = {}): Promise<number> {
  if (!hasClaudeKey()) return 0;
  const [st, stored] = await Promise.all([loadPublicStats(now), loadShareTexts()]);
  let n = 0;
  for (const kind of TOWN_SHARE_KINDS) {
    const key = shareKey(kind, st);
    if (!opts.force && stored[kind]?.key === key) continue;
    try {
      const r = await shareText(kind, st);
      await saveShareText(kind, { text: r.text, key, at: now.toISOString(), byClaude: r.byClaude });
      n++;
    } catch (e) {
      console.error("[share] 投稿文を作れませんでした:", e instanceof Error ? e.message : e);
    }
  }
  return n;
}

/** 画面で使う投稿文: 今の数字で Claude が書いたものがあればそれ、なければ定型 */
export async function shareTextsFor(st: PublicStats): Promise<Record<TownShareKind, { text: string; byClaude: boolean }>> {
  const stored = await loadShareTexts();
  const pick = (kind: TownShareKind) => {
    const s = stored[kind];
    return s && s.key === shareKey(kind, st) ? { text: s.text, byClaude: s.byClaude } : { text: mockShareText(kind, st), byClaude: false };
  };
  return { today: pick("today"), town: pick("town"), recruit: pick("recruit") };
}

/**
 * 返事を返したあとで作り直す（Vercel では next/server の after。リクエストの外ではそのまま裏で）。
 * 投稿文は急がないので、写真の完了などの返事を待たせない。
 */
export async function refreshShareTextsLater(): Promise<void> {
  if (!hasClaudeKey()) return;
  const run = () => refreshShareTexts().then(() => undefined, (e) => console.error("[share]", e));
  try {
    const { after } = await import("next/server");
    after(run);
  } catch {
    void run();
  }
}
