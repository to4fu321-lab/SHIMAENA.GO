// 「LINE でログイン」（spec v1.17）。押すと LINE の許可画面へ行き、戻ってくると本人の画面になる。LINE はここだけに使う。
export default function LoginButton({ next = "/", className = "" }: { next?: string; className?: string }) {
  return (
    <a href={`/api/auth/line/start?next=${encodeURIComponent(next)}`} className={`btn btn-big w-full bg-[#06C755] text-white ${className}`}>
      LINE でログイン
    </a>
  );
}
