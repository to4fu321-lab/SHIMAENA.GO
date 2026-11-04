"use client";

// あなたが主役の招待文（spec v1.6 → v1.8）: いまの自分の出来事から Claude が書いた3案（友だちへ・家族へ・職場や学校の人へ）。
// 押すと LINE の「送る」画面。リンクには「あなたからの招待」の印が付き、見てくれた人・町を応援してくれた人の数があなたに返ってくる。
// 自動では送らない。名前・家・場所は入っていない（サーバーで確かめ済み）。
import { INVITE_AUDIENCES } from "@/lib/invite-audiences";
import { inviteMessage, lineShareUrl } from "@/lib/share-links";

export default function InviteDrafts({ drafts, url, result }: { drafts: string[]; url?: string; result?: string }) {
  const send = (text: string) => {
    const link = url ?? inviteMessage(window.location.origin, process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL || undefined).url;
    window.open(lineShareUrl(text, link), "_blank", "noopener,noreferrer");
  };
  return (
    <section className="mt-4 space-y-2 text-left" aria-label="友だちを誘う">
      <p className="text-lg font-bold">いまのあなたの話で、仲間を誘う</p>
      {result && <p className="rounded-2xl bg-camellia-soft px-3 py-2 text-base font-bold ring-1 ring-camellia">🎉 {result}</p>}
      {drafts.map((d, i) => (
        <button
          key={i}
          onClick={() => send(d)}
          className="flex w-full flex-col gap-2 rounded-2xl bg-paper px-4 py-3 text-left text-lg ring-1 ring-ink/15 active:scale-[0.99]"
        >
          <span className="text-sm font-bold text-ink-soft">{INVITE_AUDIENCES[i] ?? "誰かへ"}</span>
          <span className="block">{d}</span>
          <span className="self-end rounded-full bg-[#06C755] px-4 py-2 text-base font-bold text-white">LINE で送る</span>
        </button>
      ))}
      <p className="text-xs text-ink-soft">送ったリンクを見てくれた人・町を応援してくれた人の数が、あとであなたに届きます（名前は分かりません）。</p>
    </section>
  );
}
