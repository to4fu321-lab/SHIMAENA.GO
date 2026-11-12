// Claude がゼロから描く絵を、発行したカードにあとから入れる（spec v1.24）。
// 発行はすぐ（型の絵に「描いています」の帯）→ 返事のあとで Claude が描く（1〜3分）→ 同じカードの表を描き直す。
// 描けなかったら、帯を外した型の絵（v1.23 の挿絵つき）に戻す。同じ家の仲間のカードは同じ絵（番号だけちがう）。
import { drawPicture, type ArtInput } from "../claude/art";
import { hasClaudeKey } from "../claude/client";
import { runLater } from "../ops/later";
import { recordProblem } from "../ops/problems";
import { repo } from "../repo";
import { renderCardSvg, type CardArt } from "./svg";

/** Claude が描けるか（キーがあるか）。描けるならカードは「描いています」で出す */
export const willDraw = () => hasClaudeKey();

/**
 * 絵を描くのに使ってよい時間（頼んだ時から）。Vercel の関数は 300 秒で打ち切られ、打ち切られると下の「型の絵に戻す」も動かず、
 * カードが「描いています」のまま残る（11/11 公開版のログで、完了のたびに 300 秒の打ち切りが出ていた）。
 * 完了の処理（写真の確認など）が先に 1 分ほど使うので、残りに収まる 200 秒で切り上げて、型の絵に戻す。
 */
export const DRAW_BUDGET_MS = 200_000;

/** 返事のあとで絵を描いて、カードの表（と裏の「なぜこの絵か」）を描き直す */
export function drawLater(cards: { id: string; art: CardArt }[], input: ArtInput, opts: { budgetMs?: number } = {}): void {
  if (!willDraw() || cards.length === 0) return;
  const until = Date.now() + (opts.budgetMs ?? DRAW_BUDGET_MS);
  runLater("cards/draw", async () => {
    const r = repo();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const late = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error("絵を描く時間が足りませんでした（型の絵にしました）")), Math.max(0, until - Date.now())); });
      const drawn = await Promise.race([drawPicture(input, { until }), late]);
      if (!drawn) throw new Error("Claude のキーがありません");
      for (const c of cards) {
        await r.updateCardFront(c.id, renderCardSvg({ ...c.art, pending: false, picture: drawn.svg }));
        const old = await r.getCard(c.id);
        if (old && drawn.why) {
          const back = old.backSvg.replace(/(この時だけの設計図 #[0-9a-f]{4} ・ )[^<]*</, (_m, head: string) => `${head}${escape(drawn.why)}<`);
          if (back !== old.backSvg) await r.updateCardBack(c.id, back);
        }
      }
      console.log(`[art] ${cards.length} 枚の絵を描きました（${drawn.rounds} 回・${drawn.seconds.toFixed(0)} 秒）`);
    } catch (e) {
      await recordProblem("cards/draw", e);
      for (const c of cards) await r.updateCardFront(c.id, renderCardSvg({ ...c.art, pending: false }));
    } finally {
      clearTimeout(timer);
    }
  });
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
