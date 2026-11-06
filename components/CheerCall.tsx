"use client";

// 「応援を呼ぶ」（11/6 本人の指示「ゲーム中にも応援を呼べるように」）: ミッション中・地図の担当・つなぐ・ホームから、
// 友だちに「いま出動中」を LINE の「送る」画面で送る（spec v1.5 の「友だちに応援を頼む」と同じ仕組み。自動では送らない）。
// 開いた人は公開ページの「町を応援する」（登録なし・1日1回）。応援の数で報酬は付けない。
import { cheerRequestMessage, lineShareUrl } from "@/lib/share-links";
import { play } from "@/lib/sound/engine";

export default function CheerCall({
  mission,
  compact = false,
  className = "",
}: {
  /** いまやっているミッションの名前（文に入れる。名前・場所は入らない） */
  mission?: string;
  /** 小さく（ミッション中の画面の1行） */
  compact?: boolean;
  className?: string;
}) {
  const call = () => {
    const m = cheerRequestMessage(window.location.origin, mission);
    play("share");
    window.open(lineShareUrl(m.text, m.url), "_blank", "noopener,noreferrer");
  };
  return (
    <button
      type="button"
      onClick={call}
      data-sound="none"
      className={
        compact
          ? `flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full bg-[#06C755]/15 px-3 text-base font-bold text-ink ring-1 ring-[#06C755]/50 ${className}`
          : `btn btn-white w-full gap-2 rounded-full text-lg ${className}`
      }
    >
      <span aria-hidden="true">📣</span>
      {compact ? "友だちに応援を呼ぶ（LINE）" : "📣 友だちに応援を呼ぶ（LINE）"}
    </button>
  );
}
