"use client";

// 自分の家の雪かき: Before / After の2枚を1枚の自慢画像にして、SNS に投稿できるようにする。
// v1.8: 縦長（4:5）にして、どけた雪の kg（推定）と、その日のカード（なければ消印）を入れる。カードは2枚目としても投稿できる。
// 画像はこの端末の中で作る（サーバーには送らない）。自動では投稿しない。
import { useEffect, useState } from "react";

const W = 1080;
const H = 1350; // Instagram の縦長（4:5）。X でもそのまま見られる

export interface BragSnow {
  kg: number;
  comparison: string;
}

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
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 20, y + 37);
}

/** カードがない日の消印（カードと同じ形。kg と日付） */
function stamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, center: string) {
  const ink = "#d81b60";
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-12 * Math.PI) / 180);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.arc(0, 0, 130, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 98, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 30px sans-serif";
  ctx.fillText("シマエナGO", 0, -62);
  ctx.font = "bold 52px sans-serif";
  ctx.fillText(center, 0, 4);
  ctx.font = "bold 26px sans-serif";
  const d = new Date();
  ctx.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, 0, 62);
  ctx.restore();
}

async function compose(before: string, after: string, minutes: number, snow?: BragSnow, card?: string): Promise<Blob> {
  const [b, a, c] = await Promise.all([loadImage(before), loadImage(after), card ? loadImage(card).catch(() => undefined) : Promise.resolve(undefined)]);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#f5eee5";
  ctx.fillRect(0, 0, W, H);
  // 見出し
  ctx.fillStyle = "#2f4a5f";
  ctx.font = "bold 64px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("うちの玄関、雪かき完了！", W / 2, 80);
  // 2枚の写真
  const top = 150;
  const ph = 700;
  const pw = (W - 60 - 20) / 2;
  drawCover(ctx, b, 30, top, pw, ph);
  drawCover(ctx, a, 30 + pw + 20, top, pw, ph);
  tag(ctx, "BEFORE", 50, top + 20, "#2f4a5f");
  tag(ctx, "AFTER", 50 + pw + 20, top + 20, "#d9825b");
  // 下の帯: どけた雪（左）とカード・消印（右）
  const band = top + ph + 30;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#2f4a5f";
  if (snow && snow.kg > 0) {
    ctx.font = "bold 44px sans-serif";
    ctx.fillText(`${minutes}分で どけた雪`, 50, band + 60);
    ctx.font = "bold 150px sans-serif";
    ctx.fillStyle = "#d9825b";
    const kgText = `${snow.kg}`;
    ctx.fillText(kgText, 44, band + 210);
    const kw = ctx.measureText(kgText).width;
    ctx.font = "bold 64px sans-serif";
    ctx.fillText("kg", 54 + kw, band + 210);
    ctx.fillStyle = "#2f4a5f";
    ctx.font = "bold 48px sans-serif";
    ctx.fillText(`＝ ${snow.comparison}`, 50, band + 290);
    ctx.font = "26px sans-serif";
    ctx.fillStyle = "#6b7f90";
    ctx.fillText("（推定）", 50, band + 336);
  } else {
    ctx.font = "bold 60px sans-serif";
    ctx.fillText(`${minutes}分でキレイに ⛄`, 50, band + 150);
  }
  // 右: カード（その日に発行されたもの）か、消印
  if (c) {
    ctx.save();
    ctx.translate(W - 190, band + 200);
    ctx.rotate((6 * Math.PI) / 180);
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 20;
    ctx.drawImage(c, -135, -189, 270, 378);
    ctx.restore();
  } else {
    stamp(ctx, W - 200, band + 190, snow && snow.kg > 0 ? `${snow.kg}kg` : "ソロ");
  }
  ctx.fillStyle = "#d9825b";
  ctx.font = "bold 36px sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("#シマエナGO #雪かき", 50, H - 30);
  return new Promise((resolve, reject) => cv.toBlob((x) => (x ? resolve(x) : reject(new Error("画像を作れませんでした"))), "image/jpeg", 0.9));
}

export default function BragShare({
  before,
  after,
  minutes,
  page,
  snow,
  cardId,
}: {
  before: string;
  after: string;
  minutes: number;
  page?: string;
  /** どけた雪（推定。手がかりがない日はなし） */
  snow?: BragSnow;
  /** その日に発行されたカード（あれば画像に添え、2枚目としても投稿する） */
  cardId?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const kgLine = snow && snow.kg > 0 ? `どけた雪 およそ${snow.kg}kg（${snow.comparison}）！\n` : "";
  const text = `玄関前の雪、${minutes}分でキレイにしました！⛄\n${kgLine}Before → After\n#シマエナGO #雪かき`;
  const cardSrc = cardId ? `/api/cards/${cardId}/front.png` : undefined;

  // カードも2枚目として投稿できるように、画像を取っておく
  useEffect(() => {
    if (!cardSrc) return;
    let alive = true;
    fetch(cardSrc)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error("カードを読めませんでした"))))
      .then((blob) => alive && setCardFile(new File([blob], "shimaena-go-card.png", { type: "image/png" })))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [cardSrc]);

  // snow は毎回新しい物になるので、中の数字だけで作り直しを決める
  const snowKg = snow?.kg;
  const snowCmp = snow?.comparison;
  useEffect(() => {
    let u: string | null = null;
    compose(before, after, minutes, snowKg && snowCmp ? { kg: snowKg, comparison: snowCmp } : undefined, cardSrc)
      .then((blob) => {
        u = URL.createObjectURL(blob);
        setFile(new File([blob], "shimaena-go-before-after.jpg", { type: "image/jpeg" }));
        setUrl(u);
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "画像を作れませんでした"));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [before, after, minutes, snowKg, snowCmp, cardSrc]);

  const share = async () => {
    if (!file) return;
    setMsg(null);
    try {
      const link = page ?? `${window.location.origin}/public/share/today?via=sns`;
      const both = cardFile ? [file, cardFile] : [file];
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: both })) {
        await navigator.share({ files: both, text: `${text}\n${link}` });
        setMsg(both.length > 1 ? "Before/After とカードの2枚を共有しました" : "共有しました");
      } else if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
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
      <p className="text-base font-bold">📸 Before → After を自慢しよう！{cardId ? "（カードも一緒に）" : ""}</p>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="雪かきの前と後の写真と、どけた雪の量" className="aspect-[4/5] w-full rounded-xl object-cover" />
      ) : (
        <div className="grid aspect-[4/5] w-full place-items-center rounded-xl bg-paper text-sm">画像をつくっています…</div>
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
