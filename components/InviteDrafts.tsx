"use client";

// あなたが主役の招待文（spec v1.6）: 今朝の自分の活動から Claude が書いた3案。押すと LINE の「送る」画面。
// 自動では送らない。名前・家・場所は入っていない（サーバーで確かめ済み）。
import { inviteMessage, lineShareUrl } from "@/lib/share-links";

export default function InviteDrafts({ drafts }: { drafts: string[] }) {
  const send = (text: string) => {
    const url = inviteMessage(window.location.origin, process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL || undefined).url;
    window.open(lineShareUrl(text, url), "_blank", "noopener,noreferrer");
  };
  return (
    <section className="mt-4 space-y-2 text-left" aria-label="友だちを誘う">
      <p className="text-lg font-bold">今朝のあなたの話で、友だちを誘う</p>
      {drafts.map((d, i) => (
        <button
          key={i}
          onClick={() => send(d)}
          className="flex w-full flex-col gap-2 rounded-2xl bg-paper px-4 py-3 text-left text-lg ring-1 ring-ink/15 active:scale-[0.99]"
        >
          <span className="block">{d}</span>
          <span className="self-end rounded-full bg-[#06C755] px-4 py-2 text-base font-bold text-white">LINE で送る</span>
        </button>
      ))}
    </section>
  );
}
