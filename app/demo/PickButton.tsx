"use client";
// デモの人のボタン（11/13 本人「デモ、ここから先いけない」）。
// 日付が変わって最初に押した人は、雪の朝をサーバーで作り直すので数十秒かかることがある。
// その間なにも変わらないと止まったように見えるので、押したら画面全体に「用意しています」を出す（ほかのボタンも押せなくなる）
import { useFormStatus } from "react-dom";

export default function PickButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        disabled={pending}
        className="flex h-full w-full items-center gap-2 rounded-2xl bg-card px-2.5 text-left shadow-sm ring-1 ring-ink/10 hover:ring-2 hover:ring-lamp"
        data-sound="tap"
      >
        {children}
      </button>
      {pending && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-50 grid place-items-center bg-paper/90 px-6 text-center text-ink"
        >
          <div className="space-y-3">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-ink/15 border-t-lamp" />
            <p className="text-xl font-bold">雪の朝を用意しています…</p>
            <p className="text-base text-ink-soft">日付が変わって最初は30秒ほどかかります</p>
          </div>
        </div>
      )}
    </>
  );
}
