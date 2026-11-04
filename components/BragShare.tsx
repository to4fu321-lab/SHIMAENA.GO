"use client";

// 自分の家の雪かき: Before / After の2枚を1枚の自慢画像にして、SNS に投稿できるようにする。
// 画像はこの端末の中で作る（サーバーには送らない）。自動では投稿しない。
import { useEffect, useState } from "react";

const SIZE = 1080;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("写真を読めませんでした"));
    img.src = src;
  });
}

/** 写真を枠いっぱいに（はみ出しは切る）描く */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

function tag(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string) {
  ctx.font = "bold 44px sans-serif";
  const w = ctx.measureText(text).width + 40;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, 70, 35);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 20, y + 37);
}

async function compose(before: string, after: string, minutes: number): Promise<Blob> {
  const [b, a] = await Promise.all([loadImage(before), loadImage(after)]);
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f5eee5";
  ctx.fillRect(0, 0, SIZE, SIZE);
  // 見出し
  ctx.fillStyle = "#2f4a5f";
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("うちの玄関、雪かき完了！", SIZE / 2, 90);
  ctx.textAlign = "left";
  // 2枚の写真
  const top = 170;
  const ph = 720;
  const pw = (SIZE - 60 - 20) / 2;
  drawCover(ctx, b, 30, top, pw, ph);
  drawCover(ctx, a, 30 + pw + 20, top, pw, ph);
  tag(ctx, "BEFORE", 50, top + 20, "#2f4a5f");
  tag(ctx, "AFTER", 50 + pw + 20, top + 20, "#d9825b");
  // 下の帯
  ctx.fillStyle = "#2f4a5f";
  ctx.font = "bold 52px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(`${minutes}分でキレイに ⛄`, SIZE / 2, top + ph + 70);
  ctx.fillStyle = "#d9825b";
  ctx.font = "bold 40px sans-serif";
  ctx.fillText("#シマエナGO #雪かき", SIZE / 2, top + ph + 140);
  return new Promise((resolve, reject) => c.toBlob((x) => (x ? resolve(x) : reject(new Error("画像を作れませんでした"))), "image/jpeg", 0.9));
}

export default function BragShare({ before, after, minutes, page }: { before: string; after: string; minutes: number; page?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const text = `玄関前の雪、${minutes}分でキレイにしました！⛄\nBefore → After\n#シマエナGO #雪かき`;

  useEffect(() => {
    let u: string | null = null;
    compose(before, after, minutes)
      .then((blob) => {
        u = URL.createObjectURL(blob);
        setFile(new File([blob], "shimaena-go-before-after.jpg", { type: "image/jpeg" }));
        setUrl(u);
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "画像を作れませんでした"));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [before, after, minutes]);

  const share = async () => {
    if (!file) return;
    setMsg(null);
    try {
      const link = page ?? `${window.location.origin}/public/share/today?via=sns`;
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text}\n${link}` });
        setMsg("共有しました");
      } else {
        save();
        setMsg("画像を保存しました。Instagram や X で選んで投稿してください");
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setMsg(e instanceof Error ? e.message : "うまくいきませんでした");
    }
  };
  const save = () => {
    if (!url || !file) return;
    const a = Object.assign(document.createElement("a"), { href: url, download: file.name });
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="pop-late mt-3 space-y-2 rounded-2xl bg-card p-3 ring-2 ring-lamp" aria-label="Before と After を自慢する">
      <p className="text-base font-bold">📸 Before → After を自慢しよう！</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="雪かきの前と後の写真" className="aspect-square w-full rounded-xl object-cover" />
      ) : (
        <div className="grid aspect-square w-full place-items-center rounded-xl bg-paper text-sm">画像をつくっています…</div>
      )}
      <button type="button" disabled={!file} onClick={share} className="btn btn-lamp w-full rounded-full text-lg">
        この画像を SNS に投稿する
      </button>
      <button type="button" disabled={!file} onClick={save} className="btn btn-white w-full text-base">
        画像を保存する
      </button>
      {msg && (
        <p className="text-sm" role="status">
          {msg}
        </p>
      )}
      <p className="text-xs text-ink-soft">表札・番地・車のナンバーが写っていないか確かめてから投稿してね。自動では投稿しません。</p>
    </div>
  );
}
