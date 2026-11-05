"use client";

// Safari など LINE の外のブラウザで開いたときの「LINE アプリで開く」（11/5 本人の報告）。
// 最初は LINE のウェブログイン（liff.login）にしたが、access.line.me が 400 Bad Request を返した（LINE 側の設定と合わない）。
// → ログインはさせず、同じページを liff.line.me の URL で開き直す。iPhone・Android では LINE アプリに切り替わり、
//   アプリの中ではログイン済みなので、LiffBridge（app/layout.tsx）がそのまま本人を確かめる。
export default function LineLoginButton({ liffId, className = "" }: { liffId?: string; className?: string }) {
  if (!liffId) return null;
  const open = () => {
    const here = `${location.pathname}${location.search}`;
    location.href = `https://liff.line.me/${liffId}${here === "/" ? "" : here}`;
  };
  return (
    <div className={`space-y-1 ${className}`}>
      <button onClick={open} className="btn btn-big w-full bg-[#06C755] text-white">
        LINE アプリで開く
      </button>
      <p className="text-sm text-ink-soft">もう LINE の友だちの方はこちら。LINE アプリに切り替わって、続きができます。</p>
    </div>
  );
}
