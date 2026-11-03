"use client";

// 「LINE で友だちを誘う」「友だちに応援を頼む」。LINE の送る画面を開くだけ（自動では送らない）。
// 招待や応援の数で報酬は付けない（spec v1.3）。
import { useState } from "react";
import { lineJoinUrl } from "@/lib/line/join";
import { cheerRequestMessage, inviteMessage, lineShareUrl } from "@/lib/share-links";

export default function FriendShare({ compact = false }: { compact?: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);

  const send = (kind: "invite" | "cheer") => {
    const origin = window.location.origin;
    const m = kind === "invite" ? inviteMessage(origin, lineJoinUrl()) : cheerRequestMessage(origin);
    window.open(lineShareUrl(m.text, m.url), "_blank", "noopener,noreferrer");
  };

  // LINE 以外（メール・ほかのアプリ）。共有シートがなければ文をコピー
  const other = async () => {
    const m = inviteMessage(window.location.origin, lineJoinUrl());
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text: m.text, url: m.url });
        return;
      }
      await navigator.clipboard.writeText(`${m.text}\n${m.url}`);
      setMsg("誘う文をコピーしました");
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setMsg("うまくいきませんでした");
    }
  };

  return (
    <section className={compact ? "space-y-2" : "space-y-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10"} aria-label="友だちを誘う・応援を頼む">
      {!compact && (
        <div>
          <h2 className="text-lg font-bold">友だちと一緒に</h2>
          <p className="text-base text-ink-soft">群れが大きいほど、雪の朝はらくになります。</p>
        </div>
      )}
      <button type="button" onClick={() => send("invite")} className="btn btn-big w-full gap-2 rounded-full bg-[#06C755] text-white shadow-md">
        <span className="rounded-md bg-white px-1.5 text-sm font-bold text-[#06C755]">LINE</span>
        LINE で友だちを誘う
      </button>
      <button type="button" onClick={() => send("cheer")} className="btn btn-white w-full gap-2 rounded-full text-lg">
        📣 友だちに応援を頼む
      </button>
      {!compact && (
        <button type="button" onClick={other} className="btn w-full text-base text-ink underline">
          ほかのアプリで誘う
        </button>
      )}
      {msg && (
        <p className="text-sm" role="status">
          {msg}
        </p>
      )}
      {!compact && <p className="text-sm text-ink-soft">LINE の「送る」画面が開きます。相手を選んで、自分で送ってください。応援は登録なし・1日1回で、得点にはなりません。</p>}
    </section>
  );
}
