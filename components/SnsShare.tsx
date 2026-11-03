"use client";

// SNS に共有（spec v1.3）。自動投稿はしない: 文は本人が読んで直してから、自分で押して投稿する。
// X は投稿画面（intent）を開くだけ。Instagram など画像の SNS は、画像を保存するか OS の共有シートで渡す。
import { useState } from "react";

export interface ShareOption {
  key: string;
  /** 選ぶボタンの文字（例: 今日の出動） */
  label: string;
  /** 投稿文の下書き（本人が直せる） */
  text: string;
  /** 画像のパス（例: /api/share/today.png）。?format= を後ろに足す */
  image: string;
  /** 投稿に付けるリンク（公開ページ） */
  page: string;
}

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

export default function SnsShare({ options, title = "SNS に投稿する" }: { options: ShareOption[]; title?: string }) {
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

  const postX = () => {
    const u = new URL("https://x.com/intent/post");
    u.searchParams.set("text", text);
    u.searchParams.set("url", opt.page);
    window.open(u.toString(), "_blank", "noopener,noreferrer");
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

  const btn = "min-h-12 rounded-2xl px-3 text-base font-bold disabled:opacity-40";
  return (
    <section id="share" className="scroll-mt-4 space-y-3 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-ink/10" aria-label={title}>
      <h2 className="text-lg font-bold">{title}</h2>
      {options.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist">
          {options.map((o) => (
            <button
              key={o.key}
              role="tab"
              aria-selected={o.key === opt.key}
              onClick={() => setKey(o.key)}
              className={`rounded-full px-3 py-1 text-sm font-bold ring-1 ${o.key === opt.key ? "bg-ink text-white ring-ink" : "bg-white text-ink ring-ink/20"}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${opt.image}${opt.image.includes("?") ? "&" : "?"}format=square`} alt={`${opt.label}のシェア画像`} className="aspect-square w-full rounded-2xl ring-1 ring-ink/10" />
      <label className="block text-sm text-ink/70">
        投稿文（直してから投稿できます）
        <textarea
          value={text}
          onChange={(e) => setTexts((t) => ({ ...t, [opt.key]: e.target.value }))}
          rows={4}
          className="mt-1 w-full rounded-2xl bg-paper p-3 text-base text-ink ring-1 ring-ink/15"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={postX} className={`${btn} bg-black text-white`}>
          X に投稿
        </button>
        <button disabled={busy} onClick={() => shareImage("square")} className={`${btn} bg-neon text-white`}>
          画像で共有
        </button>
        <button disabled={busy} onClick={() => save("square")} className={`${btn} bg-white text-ink ring-2 ring-ink/15`}>
          画像を保存
        </button>
        <button disabled={busy} onClick={() => save("story")} className={`${btn} bg-white text-ink ring-2 ring-ink/15`}>
          ストーリーズ用
        </button>
      </div>
      <button disabled={busy} onClick={copy} className="w-full text-center text-sm text-ink/70 underline">
        文をコピー
      </button>
      {msg && (
        <p className="rounded-2xl bg-paper px-3 py-2 text-sm" role="status">
          {msg}
        </p>
      )}
      <p className="text-xs text-ink/50">自動では投稿しません。名前や家の場所は画像に入りません。</p>
    </section>
  );
}
