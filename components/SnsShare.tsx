"use client";

// SNS に共有（spec v1.3）。自動投稿はしない: 文は本人が読んで直してから、自分で押して投稿する。
// X は投稿画面（intent）を開くだけ。Instagram など画像の SNS は、画像を保存するか OS の共有シートで渡す。
import { useState } from "react";
import { lineShareUrl, xShareUrl } from "@/lib/share-links";
import { play } from "@/lib/sound/engine";

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

/** compact: 完了画面のタブの中など、1画面に収める置き方（画像は小さく横に、ボタンは3列）。fill: パネルの残りの高さを埋める置き方（/share）。11/5 本人の指示「基本1画面」 */
export default function SnsShare({ options, title = "SNS に投稿する", compact = false, fill = false }: { options: ShareOption[]; title?: string; compact?: boolean; fill?: boolean }) {
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

  const postX = () => window.open(xShareUrl(text, opt.page), "_blank", "noopener,noreferrer");
  const postLine = () => window.open(lineShareUrl(text, opt.page), "_blank", "noopener,noreferrer");

  const shareImage = (format: "square" | "story") =>
    run(async () => {
      const file = await fetchImage(opt.image, format, fileName(format));
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text}\n${opt.page}` });
        play("share");
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
      play("share");
      return "文をコピーしました";
    });

  const btn = "btn text-base";
  const tabs = options.length > 1 && (
    <div className="flex flex-wrap gap-2" role="tablist">
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={o.key === opt.key}
          onClick={() => setKey(o.key)}
          className={`min-h-11 rounded-full px-3 py-1 text-sm font-bold ring-1 ${o.key === opt.key ? "bg-ink text-white ring-ink" : "bg-card text-ink ring-ink/30"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
  const image = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`${opt.image}${opt.image.includes("?") ? "&" : "?"}format=square`}
      alt={`${opt.label}のシェア画像`}
      className={compact ? "aspect-square w-24 shrink-0 self-start rounded-xl ring-1 ring-ink/10" : "aspect-square w-full rounded-2xl ring-1 ring-ink/10"}
    />
  );
  const textArea = (
    <label className="block min-w-0 flex-1 text-sm text-ink-soft">
      投稿文（直してから投稿できます）
      <textarea
        value={text}
        onChange={(e) => setTexts((t) => ({ ...t, [opt.key]: e.target.value }))}
        rows={compact ? 3 : 5}
        className={`mt-1 w-full rounded-2xl bg-paper text-base text-ink ring-1 ring-ink/15 ${compact ? "p-2" : "p-3"}`}
      />
    </label>
  );
  const status = msg && (
    <p className="rounded-2xl bg-paper px-3 py-2 text-sm" role="status">
      {msg}
    </p>
  );
  const note = <p className="text-base text-ink-soft">自動では投稿しません。名前や家の場所は画像に入りません。</p>;
  if (compact) {
    const cb = `${btn} min-h-12 px-1 leading-tight`;
    return (
      // 見出しは下の「投稿文（直してから投稿できます）」と同じ意味なので、読み上げ（aria-label）だけにして高さを詰める
      <section className="space-y-2 rounded-3xl bg-card p-3 shadow-sm ring-1 ring-ink/10" aria-label={title}>
        {tabs}
        <div className="flex gap-2">
          {image}
          {textArea}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={postX} className={`${cb} bg-black text-white`}>
            X に投稿
          </button>
          <button onClick={postLine} className={`${cb} bg-[#06C755] text-white`}>
            LINE で送る
          </button>
          <button disabled={busy} onClick={() => shareImage("square")} className={`${cb} bg-ink text-white`}>
            Instagram など
          </button>
          <button disabled={busy} onClick={() => save("square")} className={`${cb} btn-white`}>
            画像を保存
          </button>
          <button disabled={busy} onClick={() => save("story")} className={`${cb} btn-white`}>
            ストーリーズ用
          </button>
          <button disabled={busy} onClick={copy} className={`${cb} btn-white`}>
            文をコピー
          </button>
        </div>
        {status}
        {note}
      </section>
    );
  }
  if (fill) {
    // 「つなぐ › 広める」: 投稿する画像を主役に（まん中に大きく）、文は短い欄、ボタンは大きい3つ＋小さい3つ（11/6 本人の指摘「UI を分かりやすくキレイに」）
    const link = "min-h-10 whitespace-nowrap px-1.5 text-sm font-bold text-ink underline underline-offset-4 disabled:opacity-40";
    return (
      <section className="flex min-h-0 flex-1 flex-col gap-2" aria-label={title}>
        {options.length > 1 && (
          <div className="grid shrink-0 gap-1 rounded-2xl bg-card p-1 ring-1 ring-ink/10" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="tablist">
            {options.map((o) => (
              <button
                key={o.key}
                role="tab"
                aria-selected={o.key === opt.key}
                onClick={() => setKey(o.key)}
                className={`min-h-10 whitespace-nowrap rounded-xl px-0.5 text-[13px] font-bold ${o.key === opt.key ? "bg-ink text-white" : "text-ink"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={opt.key}
            src={`${opt.image}${opt.image.includes("?") ? "&" : "?"}format=square`}
            alt={`${opt.label}のシェア画像`}
            className="aspect-square max-h-[30dvh] w-auto max-w-full rounded-2xl shadow-lg ring-1 ring-ink/10"
          />
          <label className="block w-full shrink-0 text-xs font-bold text-ink-soft">
            投稿文（直してから投稿できます）
            <textarea
              value={text}
              onChange={(e) => setTexts((t) => ({ ...t, [opt.key]: e.target.value }))}
              rows={3}
              className="mt-1 w-full resize-none rounded-2xl bg-card p-2.5 text-base leading-snug text-ink ring-1 ring-ink/15"
            />
          </label>
        </div>
        <div className="grid shrink-0 grid-cols-3 gap-2">
          <button onClick={postX} className={`${btn} min-h-12 bg-black px-1 text-white shadow-md`}>X に投稿</button>
          <button onClick={postLine} className={`${btn} min-h-12 bg-[#06C755] px-1 text-white shadow-md`}>LINE で送る</button>
          <button disabled={busy} onClick={() => shareImage("square")} className={`${btn} min-h-12 bg-ink px-1 text-white shadow-md`}>画像で共有</button>
        </div>
        <div className="flex shrink-0 items-center justify-center gap-1">
          <button disabled={busy} onClick={() => save("square")} className={link}>画像を保存</button>
          <span className="text-ink/30" aria-hidden="true">・</span>
          <button disabled={busy} onClick={() => save("story")} className={link}>ストーリーズ用</button>
          <span className="text-ink/30" aria-hidden="true">・</span>
          <button disabled={busy} onClick={copy} className={link}>文をコピー</button>
        </div>
        <p className="shrink-0 text-center text-base leading-snug text-ink-soft" role="status">
          {msg ?? "自動では投稿しません。名前や家の場所は画像に入りません。"}
        </p>
      </section>
    );
  }
  return (
    <section id="share" className="scroll-mt-4 space-y-3 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10" aria-label={title}>
      <h2 className="text-lg font-bold">{title}</h2>
      {tabs}
      {image}
      {textArea}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={postX} className={`${btn} bg-black text-white`}>
          X に投稿
        </button>
        <button onClick={postLine} className={`${btn} bg-[#06C755] text-white`}>
          LINE で送る
        </button>
        <button disabled={busy} onClick={() => shareImage("square")} className={`${btn} bg-ink text-white`}>
          Instagram など（画像）
        </button>
        <button disabled={busy} onClick={() => save("square")} className={`${btn} btn-white`}>
          画像を保存
        </button>
        <button disabled={busy} onClick={() => save("story")} className={`${btn} btn-white col-span-2`}>
          ストーリーズ用
        </button>
      </div>
      <button disabled={busy} onClick={copy} className="btn w-full text-base text-ink underline">
        文をコピー
      </button>
      {status}
      {note}
    </section>
  );
}
