"use client";

// ホームの「雪かきGO！」（11/7 本人の指摘「依頼がないのにソロへ行くので、行く前に案内を」）。
// 近所の家の依頼を手伝える（作戦中で、チームの人）なら、そのまま地図へ。
// そうでなければ押したときに、なぜソロ活動になるかを書いた紙を下から出し、「ソロ活動へ」でソロに行く（もどれる）。
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import Mascot from "./Mascot";

/** ソロになる理由（文を変える） */
export type GoReason = "no-plan" | "guest" | "no-team";

const REASON: Record<GoReason, { title: string; body: string; next: string }> = {
  "no-plan": {
    title: "いま、近所からの依頼はありません",
    body: "雪の朝（10cm 積もった日）や、近所の人が「お願いする」を押したときに、ここから地図の家へ行けます。",
    next: "それまでは、自分の家の雪かきや見回りの「ソロ活動」をどうぞ。",
  },
  guest: {
    title: "登録すると、近所の家を手伝えます",
    body: "近所の家の依頼を受けるには、30秒の登録が要ります。",
    next: "まずは「ソロ活動」の画面へ。登録もそこからできます。",
  },
  "no-team": {
    title: "近所の家の依頼は、チームの人が動いています",
    body: "あなたはまだチームに入っていないので、家の依頼は受けられません。",
    next: "自分の家の雪かきや見回りの「ソロ活動」をどうぞ。",
  },
};

export default function GoButton({
  href,
  direct,
  reason,
  soloHref,
  className,
  children,
}: {
  /** 直接行く先（地図） */
  href: string;
  /** true なら案内なしで href へ */
  direct: boolean;
  reason: GoReason;
  /** 案内の「ソロ活動へ」の行き先 */
  soloHref: string;
  className: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  if (direct) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" className={`${className} text-left`}>
        {children}
      </button>
      {open && <GoNotice reason={reason} soloHref={soloHref} onClose={() => setOpen(false)} />}
    </>
  );
}

/** 案内の紙（下から出る） */
function GoNotice({ reason, soloHref, onClose }: { reason: GoReason; soloHref: string; onClose: () => void }) {
  const r = REASON[reason];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-ink/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={r.title} onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-3xl bg-paper text-ink shadow-2xl"
        style={{ fontSize: 18, animation: "go-rise 0.25s ease-out both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-ink/20" aria-hidden="true" />
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-2 pt-2">
          <div className="flex items-center gap-3">
            <Mascot size={64} mood="happy" className="shrink-0" />
            <h2 className="min-w-0 text-xl font-bold leading-snug">{r.title}</h2>
          </div>
          <p className="text-base leading-snug text-ink-soft">{r.body}</p>
          <p className="rounded-2xl bg-ice-soft px-3 py-2 text-base font-bold leading-snug">
            <span aria-hidden="true">⛏️ </span>
            {r.next}
          </p>
        </div>
        <div className="shrink-0 space-y-2 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-1">
          <Link href={soloHref} className="btn btn-lamp min-h-14 w-full rounded-full text-lg" data-sound="go">
            ソロ活動へ行く
          </Link>
          <button type="button" onClick={onClose} className="btn btn-white min-h-12 w-full rounded-full text-base" data-sound="back">
            もどる
          </button>
        </div>
      </div>
      <style>{`@keyframes go-rise { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  );
}
