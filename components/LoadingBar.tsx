"use client";

// 読み込み中の表示（spec v1.58）: 何かを読み込んでいるあいだ、画面のいちばん上に動く細い帯、
// 0.4秒を過ぎたら下に「読み込み中…」の札（くるくる）。5秒を過ぎたら「もう少しかかります（◯秒）」。押しても何も起きない（邪魔しない）。
import { useEffect, useState } from "react";
import { installLoadingWatch, onLoading } from "@/lib/ui/loading";

export default function LoadingBar() {
  const [state, setState] = useState<{ busy: number; since: number | null }>({ busy: 0, since: null });
  const [now, setNow] = useState(0); // 時計は読み込みが始まってから（画面を作るときに Date.now() を使わない）
  useEffect(() => {
    installLoadingWatch();
    return onLoading((busy, since) => setState({ busy, since }));
  }, []);
  useEffect(() => {
    if (!state.busy) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [state.busy]);
  if (!state.busy || state.since === null) return null;
  const ms = now === 0 ? 0 : Math.max(0, now - state.since);
  const sec = Math.floor(ms / 1000);
  return (
    <>
      <div className="loading-bar pointer-events-none fixed inset-x-0 top-0 z-[2000] h-1 overflow-hidden" aria-hidden="true">
        <span />
      </div>
      {ms > 400 && (
        <div
          className="pointer-events-none fixed inset-x-0 bottom-[max(96px,calc(env(safe-area-inset-bottom)+96px))] z-[2000] flex justify-center px-4"
          role="status"
          aria-live="polite"
        >
          <p className="flex items-center gap-2 rounded-full bg-ink/90 px-4 py-2 text-base font-bold text-white shadow-lg">
            <span className="loading-spin inline-block size-5 rounded-full border-[3px] border-white/30 border-t-white" aria-hidden="true" />
            {sec >= 5 ? `もう少しかかります…（${sec}秒）` : "読み込み中…"}
          </p>
        </div>
      )}
    </>
  );
}
