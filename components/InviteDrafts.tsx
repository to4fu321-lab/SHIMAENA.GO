"use client";

// あなたが主役の招待文（spec v1.6 → v1.8）: いまの自分の出来事から Claude が書いた3案（友だちへ・家族へ・職場や学校の人へ）。
// 押すと LINE の「送る」画面。リンクには「あなたからの招待」の印が付き、見てくれた人・町を応援してくれた人の数があなたに返ってくる。
// 自動では送らない。名前・家・場所は入っていない（サーバーで確かめ済み）。
import { INVITE_AUDIENCES } from "@/lib/invite-audiences";
import { inviteMessage, lineShareUrl } from "@/lib/share-links";
import { PagedList } from "./Pager";

export default function InviteDrafts({ drafts, url, result }: { drafts: string[]; url?: string; result?: string }) {
  const send = (text: string) => {
    const link = url ?? inviteMessage(window.location.origin, process.env.NEXT_PUBLIC_LINE_ADD_FRIEND_URL || undefined).url;
    window.open(lineShareUrl(text, link), "_blank", "noopener,noreferrer");
  };
  return (
    <section className="space-y-1.5 text-left" aria-label="友だちを誘う">
      <p className="text-lg font-bold">いまのあなたの話で、仲間を誘う</p>
      {result && <p className="rounded-2xl bg-camellia-soft px-3 py-2 text-base font-bold ring-1 ring-camellia">🎉 {result}</p>}
      {/* 1画面に収めるため、3案は1つずつ ‹ › で（11/5 本人の指示） */}
      <PagedList
        items={drafts}
        label="誘う文"
        render={(d, i) => (
          <button
            key={i}
            onClick={() => send(d)}
            className="flex w-full flex-col gap-1.5 rounded-2xl bg-paper px-4 py-2 text-left text-lg ring-1 ring-ink/15 active:scale-[0.99]"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-ink-soft">{INVITE_AUDIENCES[i] ?? "誰かへ"}</span>
              <span className="shrink-0 rounded-full bg-[#06C755] px-4 py-1.5 text-base font-bold text-white">LINE で送る</span>
            </span>
            <span className="block">{d}</span>
          </button>
        )}
      />
      <p className="rounded-2xl bg-warm px-3 py-1.5 text-sm font-bold">
        🎁 見てくれたら +2羽、町を応援してくれたら +3羽。友だちが仲間になって初出動したら +20羽と、二人に限定カード「ふたりの群れ」。
      </p>
      <p className="text-xs text-ink-soft">誘った結果（人数）はあとであなたに届きます（名前は分かりません）。</p>
    </section>
  );
}
