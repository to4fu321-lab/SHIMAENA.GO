"use client";

// 完了画面の「みんなに知らせる」: X・LINE・Instagram（画像）を1回で開ける。自動では投稿しない。
import { useState } from "react";
import { cheerRequestMessage, lineShareUrl, xShareUrl } from "@/lib/share-links";
import { play } from "@/lib/sound/engine";

export default function QuickShare({ text, image, page }: { text: string; image: string; page?: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const link = () => page ?? `${window.location.origin}/public/share/today?via=sns`;
  const open = (url: string) => window.open(url, "_blank", "noopener,noreferrer");

  // Instagram はリンクからの投稿ができないので、画像を共有シートで渡す（なければ保存）
  const instagram = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`${image}${image.includes("?") ? "&" : "?"}format=square`);
      if (!res.ok) throw new Error("画像を作れませんでした");
      const file = new File([await res.blob()], "shimaena-go.png", { type: "image/png" });
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        play("share");
        setMsg("共有しました");
      } else {
        const url = URL.createObjectURL(file);
        const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setMsg("画像を保存しました。Instagram で選んで投稿してください");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setMsg(e instanceof Error ? e.message : "うまくいきませんでした");
    } finally {
      setBusy(false);
    }
  };

  const cheer = () => {
    const c = cheerRequestMessage(window.location.origin);
    open(lineShareUrl(c.text, c.url));
  };

  return (
    <div className="mt-3 space-y-2 rounded-2xl bg-card px-3 py-3 ring-1 ring-ink/10" aria-label="みんなに知らせる">
      <p className="text-base font-bold">みんなに知らせる</p>
      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={() => open(xShareUrl(text, link()))} className="btn bg-black px-1 text-base text-white">
          X
        </button>
        <button type="button" onClick={() => open(lineShareUrl(text, link()))} className="btn bg-[#06C755] px-1 text-base text-white">
          LINE
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={instagram}
          className="btn px-1 text-base text-white"
          style={{ background: "linear-gradient(135deg,#f9a03f,#d6336c 55%,#7b3fbf)" }}
        >
          Instagram
        </button>
      </div>
      <button type="button" onClick={cheer} className="btn btn-white w-full gap-1 text-base">
        📣 友だちに応援を頼む（LINE）
      </button>
      {msg && (
        <p className="text-sm" role="status">
          {msg}
        </p>
      )}
      <p className="text-xs text-ink-soft">自動では投稿しません。名前や家の場所は入りません。</p>
    </div>
  );
}
