// SNS・LINE に送るためのリンクと文（自動では投稿しない。本人が開いて、読んで、自分で送る）。
// 名前・家の場所は入れない。招待や応援の数で報酬は付けない（spec v1.3）。

/** LINE の「送る」画面（友だち・グループを選んで送る） */
export function lineShareUrl(text: string, url?: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(url ? `${text}\n${url}` : text)}`;
}

/** X の投稿画面 */
export function xShareUrl(text: string, url?: string): string {
  const u = new URL("https://x.com/intent/post");
  u.searchParams.set("text", text);
  if (url) u.searchParams.set("url", url);
  return u.toString();
}

/** 友だちを誘う文。参加先は LINE の友だち追加（なければ公開ページ） */
export function inviteMessage(origin: string, joinUrl?: string): { text: string; url: string } {
  return {
    text: "雪の朝、10分だけ町内の雪かきを一緒にしませんか？⛄\nシマエナGO は LINE で1分で参加できます。ひとりの10分で、町が変わる。",
    url: joinUrl ?? `${origin}/public/town?via=sns`,
  };
}

/** 友だちに応援を頼む文。開くと公開ページの「町を応援する」へ（登録なし・1日1回） */
export function cheerRequestMessage(origin: string): { text: string; url: string } {
  return {
    text: "いま、町内の雪かきに出動しています！⛄\nよかったら「町を応援する」を押してください（登録なし・1日1回）。",
    url: `${origin}/public/town?via=cheer#cheer`,
  };
}

/** 完了したときの投稿文（数字だけ。名前や場所は入れない） */
export function clearMessage(kind: "house" | "solo", minutes = 5): string {
  return kind === "house"
    ? `今朝の雪かきで、1軒の家に灯りがともりました。⛄\n${minutes}分の雪かきで、町が変わる。\n#シマエナGO #雪かき`
    : `今朝、ひとりで${minutes}分の雪かき出動をしました。⛄\n10分の雪かきで、町が変わる。\n#シマエナGO #雪かき`;
}
