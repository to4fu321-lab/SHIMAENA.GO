"use client";

// 公開ページ /public/town の「広める」タブ（1画面に収まる形）。中身は SnsShare と同じ: 自動投稿はしない。
// 文は本人が読んで直してから、自分で押して投稿する。画像は小さく見せ、ボタンは2列に並べる。
import { useState } from "react";
import { lineShareUrl, xShareUrl } from "@/lib/share-links";
import type { ShareOption } from "./SnsShare";

async function fetchImage(path: string, format: "square" | "story", fileName: string): Promise<File> {
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${path}${sep}format=${format}`);
  if (!res.ok) throw new Error("画像を作れませんでした");
  return new File([await res.blob()], fileName, { type: "image/png" });
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function TownShare({ options, title }: { options: ShareOption[]; title: string }) {
  const [key, setKey] = useState(options[0]?.key);
  const opt = options.find((o) => o.key === key) ?? options[0];
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!opt) return null;
  const text = texts[opt.key] ?? opt.text;
  const fileName = (f: string) => `shimaena-go-${opt.key}-${f}.png`;

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fn();
      if (r) setMsg(r);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return; // 共有をやめた
      setMsg(e instanceof Error ? e.message : "うまくいきませんでした");
    } finally {
      setBusy(false);
    }
  };

  const shareImage = (format: "square" | "story") =>
    run(async () => {
      const file = await fetchImage(opt.image, format, fileName(format));
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text}\n${opt.page}` });
        return "共有しました";
      }
      download(file);
      return "画像を保存しました。Instagram などで選んでください";
    });
  const save = (format: "square" | "story") =>
    run(async () => {
      download(await fetchImage(opt.image, format, fileName(format)));
      return format === "story" ? "ストーリーズ用（9:16）を保存しました" : "正方形の画像を保存しました";
    });
  const copy = () =>
    run(async () => {
      await navigator.clipboard.writeText(`${text}\n${opt.page}`);
      return "文をコピーしました";
    });

  const btn = "btn text-base";
  return (
    <div className="flex flex-1 flex-col gap-2" aria-label={title}>
      <h2 className="text-lg font-bold">{title}</h2>
      <div className="flex gap-2" role="tablist">
        {options.map((o) => (
          <button
            key={o.key}
            role="tab"
            aria-selected={o.key === opt.key}
            onClick={() => setKey(o.key)}
            className={`min-h-11 flex-1 rounded-full px-2 py-1 text-sm font-bold ring-1 ${o.key === opt.key ? "bg-ink text-white ring-ink" : "bg-card text-ink ring-ink/30"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="flex h-24 shrink-0 gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${opt.image}${opt.image.includes("?") ? "&" : "?"}format=square`} alt={`${opt.label}のシェア画像`} className="aspect-square h-24 w-24 shrink-0 rounded-2xl ring-1 ring-ink/10" />
        <label className="flex min-w-0 flex-1 flex-col text-sm text-ink-soft">
          投稿文（直せます）
          <textarea
            value={text}
            onChange={(e) => setTexts((t) => ({ ...t, [opt.key]: e.target.value }))}
            className="mt-1 min-h-0 w-full flex-1 resize-none rounded-2xl bg-paper p-2 text-base text-ink ring-1 ring-ink/15"
          />
        </label>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2">
        <button onClick={() => window.open(xShareUrl(text, opt.page), "_blank", "noopener,noreferrer")} className={`${btn} bg-black text-white`}>
          X に投稿
        </button>
        <button onClick={() => window.open(lineShareUrl(text, opt.page), "_blank", "noopener,noreferrer")} className={`${btn} bg-[#06C755] text-white`}>
          LINE で送る
        </button>
        <button disabled={busy} onClick={() => shareImage("square")} className={`${btn} bg-ink text-white`}>
          Instagram など
        </button>
        <button disabled={busy} onClick={() => save("square")} className={`${btn} btn-white`}>
          画像を保存
        </button>
        <button disabled={busy} onClick={() => save("story")} className={`${btn} btn-white`}>
          ストーリーズ用
        </button>
        <button disabled={busy} onClick={copy} className={`${btn} btn-white`}>
          文をコピー
        </button>
      </div>
      <p className="shrink-0 text-sm text-ink-soft" role="status">
        {msg ?? "自動では投稿しません。名前や家の場所は画像に入りません。"}
      </p>
    </div>
  );
}
