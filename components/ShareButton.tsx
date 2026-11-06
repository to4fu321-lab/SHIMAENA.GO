"use client";

// 「結果をコピー」: 絵文字グリッドを共有（共有シートがあれば共有、なければコピー）。
import { useState } from "react";
import { play } from "@/lib/sound/engine";

export default function ShareButton({ text }: { text: string }) {
  const [done, setDone] = useState<string | null>(null);

  const share = async () => {
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ text });
        play("share");
        setDone("共有しました");
        return;
      }
      await navigator.clipboard.writeText(text);
      play("share");
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
      <button onClick={share} className="btn btn-white text-base">
        結果をコピー
      </button>
      <pre className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-pre-wrap font-sans text-xs leading-tight text-ink-soft" aria-label="共有する文字">
        {text.split("\n").slice(1, -2).join("\n")}
      </pre>
      {done && (
        <p className="w-full text-sm text-ink-soft" role="status">
          {done}
        </p>
      )}
    </div>
  );
}
