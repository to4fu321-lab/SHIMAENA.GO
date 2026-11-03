"use client";

// 設定: 登録のやり直し。LINE の中（LIFF）で開いていれば、トークに「登録」を送って LINE に戻る。
// それができないとき（LINE の外・権限がない）は、やり方を文字で案内する。どちらでも困らないように。
import { useState } from "react";

export default function RedoRegistration({ liffId }: { liffId?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const redo = async () => {
    setBusy(true);
    setMsg(null);
    try {
      if (!liffId) throw new Error("no-liff");
      const { default: liff } = await import("@line/liff");
      await liff.init({ liffId });
      if (!liff.isInClient()) throw new Error("not-in-line");
      await liff.sendMessages([{ type: "text", text: "登録" }]);
      liff.closeWindow();
    } catch {
      setMsg("LINE のトーク画面で「登録」と送ってください。最初の質問から、やり直せます。今の記録（羽やカード）は消えません。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <button onClick={redo} disabled={busy} className="btn btn-ink w-full text-lg">
        {busy ? "LINE を開いています…" : "登録をやり直す（LINE で）"}
      </button>
      {msg && (
        <p className="rounded-2xl bg-warm px-3 py-2 text-base ring-1 ring-lamp/50" role="status">
          {msg}
        </p>
      )}
    </div>
  );
}
