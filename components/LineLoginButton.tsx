"use client";

// Safari など LINE の外のブラウザで開いたときのログイン（spec v1.16「LINE 登録者は LINE アプリ経由でなくても参加できる」）。
// 「LINE で送ってログイン」を押す → LINE が開き、公式アカウントへのトークに「ログイン ABC123」が入っている → 送信を押す
// → このブラウザに戻ると数秒で本人の画面になる（180日そのまま）。LINE ログインの設定は要らない。
// LINE アプリの中で開き直したい人には「LINE アプリで開く」も残す。
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { checkWebLoginAction, startWebLoginAction } from "@/app/login/actions";

export default function LineLoginButton({ liffId, className = "" }: { liffId?: string; className?: string }) {
  const router = useRouter();
  const [code, setCode] = useState<string>();
  const [sendUrl, setSendUrl] = useState<string>();
  const [state, setState] = useState<"idle" | "busy" | "waiting" | "done" | "error">("idle");
  const timer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  useEffect(() => () => clearInterval(timer.current), []);

  const begin = async () => {
    setState("busy");
    const r = await startWebLoginAction().catch(() => ({ ok: false as const, minutes: 10 }));
    if (!r.ok || !("code" in r) || !r.code) return setState("error");
    setCode(r.code);
    setSendUrl(r.sendUrl);
    setState("waiting");
    const started = Date.now();
    clearInterval(timer.current);
    timer.current = setInterval(async () => {
      if (Date.now() - started > r.minutes * 60_000) {
        clearInterval(timer.current);
        setState("idle");
        return;
      }
      const c = await checkWebLoginAction(r.code!).catch(() => ({ ok: false }));
      if (c.ok) {
        clearInterval(timer.current);
        setState("done");
        router.refresh();
      }
    }, 2500);
    if (r.sendUrl) location.href = r.sendUrl; // そのまま LINE を開く（文は入った状態）
  };

  const openInLine = () => {
    const here = `${location.pathname}${location.search}`;
    location.href = `https://liff.line.me/${liffId}${here === "/" ? "" : here}`;
  };
  return (
    <div className={`space-y-2 ${className}`}>
      {state === "waiting" && code ? (
        <div className="space-y-2 rounded-2xl bg-ice-soft p-3 text-center ring-1 ring-ice" role="status">
          <p className="text-base">LINE で、この合言葉を送ってください</p>
          <p className="text-3xl font-bold tracking-widest tabular-nums">ログイン {code}</p>
          {sendUrl && (
            <a href={sendUrl} className="btn btn-big w-full bg-[#06C755] text-white">
              LINE で送る
            </a>
          )}
          <p className="text-sm text-ink-soft">送ったら、この画面に戻ってください。数秒で切りかわります（10分で切れます）。</p>
        </div>
      ) : state === "done" ? (
        <p className="rounded-2xl bg-ice-soft px-3 py-2 text-center text-lg font-bold">✅ ログインしました</p>
      ) : (
        <>
          <button onClick={begin} disabled={state === "busy"} className="btn btn-big w-full bg-[#06C755] text-white">
            {state === "busy" ? "準備しています…" : "LINE で送ってログイン"}
          </button>
          <p className="text-sm text-ink-soft">もう LINE の友だちの方はこちら。このブラウザのまま使えます（LINE で合言葉を1回送るだけ）。</p>
          {state === "error" && <p className="text-sm text-alert">うまく準備できませんでした。もう一度押してください。</p>}
        </>
      )}
      {liffId && state !== "done" && (
        <button onClick={openInLine} className="block w-full text-center text-base underline">
          LINE アプリの中で開く
        </button>
      )}
    </div>
  );
}
