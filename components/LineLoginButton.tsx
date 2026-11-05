"use client";

// Safari など LINE の外のブラウザで開いたときの「LINE でログインして続ける」（11/5 本人の報告: LINE の友だちなのに Safari で開いてソロに進めない）。
// LINE ログインのあと、同じページに戻ってくる。戻ると LiffBridge（app/layout.tsx）が本人を確かめて画面を本人の中身にする。
import { useState } from "react";

export default function LineLoginButton({ liffId, className = "" }: { liffId?: string; className?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  if (!liffId) return null;
  const login = async () => {
    setBusy(true);
    setErr(false);
    try {
      const { default: liff } = await import("@line/liff");
      await liff.init({ liffId });
      if (liff.isLoggedIn()) {
        location.reload(); // もうログインしている → 本人の確認をやり直す
        return;
      }
      liff.login({ redirectUri: location.href });
    } catch (e) {
      console.warn("[liff login]", e);
      setErr(true);
      setBusy(false);
    }
  };
  return (
    <div className={`space-y-1 ${className}`}>
      <button onClick={login} disabled={busy} className="btn btn-big w-full bg-[#06C755] text-white">
        {busy ? "LINE を開いています…" : "LINE でログインして続ける"}
      </button>
      <p className="text-sm text-ink-soft">もう LINE の友だちの方はこちら。ブラウザで開いたときも、ログインすると続きができます。</p>
      {err && <p className="text-sm text-alert">うまく開けませんでした。LINE のトークの「きょうの町」から開いてください。</p>}
    </div>
  );
}
