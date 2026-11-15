// 「1軒 完了！」の画面で、シマエナ隊長が声で言うこと（spec v1.61）。画面に出ている判定と同じ中身を読む（純粋な関数）。
// 最初の一言はいつも同じ文にする: 声は文ごとに作って残すので（/api/voice）、同じ文なら2回目からすぐ鳴る。
// 星の数は画面と同じく、プログラムが数えた ✓ の数（AI に点数は付けさせない）。
import type { ClearSummary } from "./clear";

/** 最初の一言（いつも同じ。12字以上にして、声を作るときにこの一言だけで切れるようにする。lib/speech/split.ts） */
export const CLEAR_VOICE_HEAD = "やったー！1軒完了だしま〜！";

/** 写真の判定の星（✓ の数）。確かめきれなかった・写真なしは undefined */
export function photoStars(photo: ClearSummary["photo"]): number | undefined {
  if (!photo || photo.uncertain) return undefined;
  return [photo.cleared, photo.passable, !photo.icy].filter(Boolean).length;
}

/** 星の数のひとこと（画面の見出しと同じ） */
export function verdictWord(stars: number | undefined): string {
  return stars === undefined ? "報告として受け付けました" : stars === 3 ? "ばっちり！" : stars === 2 ? "よくできました" : "受け付けました";
}

/** 隊長が読む文: 完了 → 写真の判定（星）→ 隊長のひとこと → 危ないもの。全体で 180 字まで（声の上限） */
export function clearVoiceText(clear: Pick<ClearSummary, "baseNumber" | "photo" | "hazards">): string {
  const photo = clear.photo;
  const stars = photoStars(photo);
  const parts = [CLEAR_VOICE_HEAD, `拠点${clear.baseNumber}に灯りがともりました。`];
  if (photo) {
    if (photo.pending) return [...parts, "写真の判定は、できしだい隊長トークに届けます。"].join("").slice(0, 180);
    parts.push(stars === undefined ? "写真は、報告として受け付けました。" : `写真の判定は、星${stars}つ。${verdictWord(stars).replace(/([^！。])$/, "$1。")}`);
    // 画面のコメント。かっこの中（注意書き）は読まない
    const comment = photo.comment.replace(/（[^）]*）/g, "").trim().slice(0, 70);
    if (comment) parts.push(/[。！？]$/.test(comment) ? comment : `${comment}。`);
  }
  for (const h of (clear.hazards ?? []).slice(0, 1)) parts.push(/[。！？]$/.test(h) ? h : `${h}。`);
  return parts.join("").slice(0, 180);
}
