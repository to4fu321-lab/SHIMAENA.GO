"use client";

// 「結果をコピー」: 絵文字グリッドを共有（共有シートがあれば共有、なければコピー）。
import { useState } from "react";

export default function ShareButton({ text }: { text: string }) {
  const [done, setDone] = useState<string | null>(null);

  const share = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text });
        setDone("共有しました");
        return;
      }
      await navigator.clipboard.writeText(text);
      setDone("コピーしました。LINE や X に貼れます");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // 共有をやめた
      try {
        await navigator.clipboard.writeText(text);
        setDone("コピーしました。LINE や X に貼れます");
      } catch {
        setDone("コピーできませんでした");
      }
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={share} className="rounded-2xl bg-white px-4 py-2 text-base font-bold text-ink ring-2 ring-ink/15">
        結果をコピー
      </button>
      <pre className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-pre-wrap font-sans text-xs leading-tight text-ink/70" aria-label="共有する文字">
        {text.split("\n").slice(1, -2).join("\n")}
      </pre>
      {done && (
        <p className="w-full text-sm text-ink/70" role="status">
          {done}
        </p>
      )}
    </div>
  );
}
