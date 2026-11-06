"use client";

// 自分の家の雪かき: Before / After の2枚を1枚の自慢画像にして、SNS に投稿できるようにする。
// v1.8: 縦長（4:5）にして、どけた雪の kg（推定）と、その日のカード（なければ消印）を入れる。カードは2枚目としても投稿できる。
// 画像はこの端末の中で作る。自動では投稿しない。
// v1.11: 作る前に、2枚の写真のナンバー・表札・顔・家を AI でぼかす（ぼかす場所を聞くために写真をサーバーへ送るが、保存はしない）。
import { useEffect, useState } from "react";
import { blurNote, blurPrivate } from "./blur";
import { play } from "@/lib/sound/engine";

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
  ctx.font = `900 40px ${family()}`;
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

/** 画面と同じ文字（Noto Sans JP → ヒラギノなど）。太さは 700 と 900 を使う */
function family(): string {
  try {
    return getComputedStyle(document.body).fontFamily || "sans-serif";
  } catch {
    return "sans-serif";
  }
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** 蛍光ペンの下線（文字の下 3分の1） */
function marker(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h = 18, color = "rgba(255, 214, 79, 0.75)") {
  ctx.fillStyle = color;
  rr(ctx, x, y, w, h, h / 2);
  ctx.fill();
}

/** シマエナガのアイコン（アプリのマスコット。ふわふわの丸） */
function avatar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const g = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  g.addColorStop(0, "#b9a6ff");
  g.addColorStop(1, "#ffb3d9");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.ellipse(cx, cy + 4, r * 0.72, r * 0.66, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#29445c";
  for (const dx of [-0.24, 0.24]) {
    ctx.beginPath();
    ctx.arc(cx + dx * r, cy - 2, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.06, cy + r * 0.08);
  ctx.lineTo(cx + r * 0.06, cy + r * 0.08);
  ctx.lineTo(cx, cy + r * 0.17);
  ctx.fill();
  ctx.fillStyle = "rgba(242,150,170,0.7)";
  for (const dx of [-0.42, 0.42]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx * r, cy + r * 0.12, r * 0.11, r * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#e8834f";
  rr(ctx, cx - r * 0.6, cy + r * 0.5, r * 1.2, r * 0.18, r * 0.09);
  ctx.fill();
}

/** キラッとした線（見出しの左） */
function burst(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = "#ffc93c";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  for (const [dx1, dy1, dx2, dy2] of [
    [0, 10, 18, 28],
    [22, -6, 30, 22],
    [-14, 40, 12, 44],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x + dx1, y + dy1);
    ctx.lineTo(x + dx2, y + dy2);
    ctx.stroke();
  }
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color = "#ffd84f") {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
}

/** カードがない日の消印（カードと同じ形。kg と日付） */
function stamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, center: string, font: string) {
  const ink = "#d81b60";
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-12 * Math.PI) / 180);
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.beginPath();
  ctx.arc(0, 0, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 8;
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(0, 0, 90, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 28px ${font}`;
  ctx.fillText("シマエナGO", 0, -56);
  ctx.font = `900 48px ${font}`;
  ctx.fillText(center, 0, 4);
  ctx.font = `700 24px ${font}`;
  const d = new Date();
  ctx.fillText(`${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`, 0, 56);
  ctx.restore();
}

async function compose(before: string, after: string, minutes: number, snow?: BragSnow, card?: string): Promise<Blob> {
  try {
    await document.fonts.ready;
  } catch {
    // 文字の読み込みを待てなくても描く
  }
  const font = family();
  const [b, a, c] = await Promise.all([loadImage(before), loadImage(after), card ? loadImage(card).catch(() => undefined) : Promise.resolve(undefined)]);
  const cv = document.createElement("canvas");
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext("2d")!;

  // 背景: 雪の日の淡い青と、ぼけた光の粒
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#dbe7f3");
  bg.addColorStop(1, "#f3f7fb");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  for (const [x, y, r, o] of [
    [80, 60, 70, 0.35],
    [990, 140, 90, 0.3],
    [40, 1180, 110, 0.3],
    [1020, 1280, 80, 0.35],
    [560, 30, 40, 0.4],
  ]) {
    ctx.fillStyle = `rgba(255,255,255,${o})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // 白いパネル（投稿の中の1枚のように）
  ctx.save();
  ctx.shadowColor = "rgba(41,68,92,0.18)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#ffffff";
  rr(ctx, 30, 30, W - 60, 1200, 44);
  ctx.fill();
  ctx.restore();

  // 名前の行（アイコンとアプリの名前だけ。実在しないアカウント名や認証のしるしは入れない）
  avatar(ctx, 104, 108, 46);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#1f2f3f";
  ctx.font = `900 40px ${font}`;
  ctx.fillText("シマエナGO", 168, 104);
  ctx.fillStyle = "#7a8b99";
  ctx.font = `700 26px ${font}`;
  ctx.fillText("きょうの雪かき記録", 170, 142);
  ctx.fillStyle = "#b6c2cc";
  for (const dx of [0, 18, 36]) {
    ctx.beginPath();
    ctx.arc(980 + dx - 18, 104, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // 見出し
  const title = "うちの玄関、雪かき完了！";
  ctx.font = `900 70px ${font}`;
  const tw = ctx.measureText(title).width;
  const tx = (W - tw) / 2 + 10;
  marker(ctx, tx + tw * 0.42, 252, tw * 0.5, 20);
  burst(ctx, tx - 70, 196);
  ctx.fillStyle = "#1f2f3f";
  ctx.fillText(title, tx, 260);
  ctx.fillStyle = "#8fc0e8";
  ctx.font = `700 56px ${font}`;
  ctx.fillText("❄", tx + tw + 12, 258);

  // 2枚の写真（斜めに切って並べる）
  const px = 66;
  const py = 296;
  const pw = W - 132;
  const ph = 540;
  const mid = px + pw / 2;
  const slant = 36;
  ctx.save();
  rr(ctx, px, py, pw, ph, 30);
  ctx.clip();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.lineTo(mid + slant, py);
  ctx.lineTo(mid - slant, py + ph);
  ctx.lineTo(px, py + ph);
  ctx.closePath();
  ctx.clip();
  drawCover(ctx, b, px, py, pw / 2 + slant, ph);
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(mid + slant, py);
  ctx.lineTo(px + pw, py);
  ctx.lineTo(px + pw, py + ph);
  ctx.lineTo(mid - slant, py + ph);
  ctx.closePath();
  ctx.clip();
  drawCover(ctx, a, mid - slant, py, pw / 2 + slant, ph);
  ctx.restore();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(mid + slant, py);
  ctx.lineTo(mid - slant, py + ph);
  ctx.stroke();
  ctx.restore();
  tag(ctx, "BEFORE", px + 22, py + 22, "#29445c");
  tag(ctx, "AFTER", mid + slant + 20, py + 22, "#e8834f");
  // 真ん中の矢印
  ctx.save();
  ctx.translate(mid, py + ph / 2);
  ctx.fillStyle = "#ffc93c";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(-40, -16);
  ctx.lineTo(4, -16);
  ctx.lineTo(4, -36);
  ctx.lineTo(44, 0);
  ctx.lineTo(4, 36);
  ctx.lineTo(4, 16);
  ctx.lineTo(-40, 16);
  ctx.closePath();
  ctx.stroke();
  ctx.fill();
  ctx.restore();
  sparkle(ctx, px + pw - 40, py + 210, 22);
  sparkle(ctx, px + pw - 70, py + 260, 12);

  // 下: どけた雪（左）・吹き出し（真ん中）・カード（右）
  const band = py + ph + 30;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  if (snow && snow.kg > 0) {
    ctx.font = `900 42px ${font}`;
    const lead = `${minutes}分で`;
    const lw = ctx.measureText(lead).width;
    marker(ctx, 70, band + 44, lw + 6, 14);
    ctx.fillStyle = "#29445c";
    ctx.fillText(`${lead} どけた雪`, 72, band + 50);
    ctx.font = `900 160px ${font}`;
    ctx.fillStyle = "#ef7a2f";
    const kgText = `${snow.kg}`;
    ctx.fillText(kgText, 62, band + 190);
    const kw = ctx.measureText(kgText).width;
    ctx.font = `900 70px ${font}`;
    ctx.fillText("kg", 72 + kw, band + 190);
    ctx.font = `900 52px ${font}`;
    const cmp = `= ${snow.comparison}`;
    const cw = ctx.measureText(cmp).width;
    marker(ctx, 70, band + 246, cw + 8, 16);
    ctx.fillStyle = "#1f2f3f";
    ctx.fillText(cmp, 72, band + 256);
    ctx.font = `700 28px ${font}`;
    ctx.fillStyle = "#7a8b99";
    ctx.fillText("（推定）", 72, band + 300);
  } else {
    ctx.font = `900 64px ${font}`;
    ctx.fillStyle = "#29445c";
    ctx.fillText(`${minutes}分で`, 72, band + 110);
    ctx.fillText("キレイに！", 72, band + 190);
  }

  // 吹き出し（限定オリジナルカード）
  ctx.save();
  ctx.translate(640, band + 130);
  ctx.rotate((-7 * Math.PI) / 180);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#5b86b5";
  ctx.lineWidth = 4;
  rr(ctx, -136, -66, 272, 122, 56);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(60, 50);
  ctx.lineTo(108, 90);
  ctx.lineTo(94, 46);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(60, 53);
  ctx.lineTo(108, 90);
  ctx.lineTo(94, 49);
  ctx.stroke();
  ctx.fillStyle = "#29445c";
  ctx.textAlign = "center";
  ctx.font = `900 32px ${font}`;
  ctx.fillText(card ? "限定オリジナル" : "シマエナGO の", 0, -14);
  ctx.fillText(card ? "カードも貰った！" : "消印も押された！", 0, 32);
  ctx.restore();
  sparkle(ctx, 790, band + 40, 16);

  // 右: カード（なければ消印）
  if (c) {
    ctx.save();
    ctx.translate(W - 165, band + 165);
    ctx.rotate((7 * Math.PI) / 180);
    ctx.shadowColor = "rgba(41,68,92,0.3)";
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = "#ffffff";
    rr(ctx, -118, -162, 236, 324, 16);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.drawImage(c, -109, -153, 218, 306);
    ctx.restore();
  } else {
    stamp(ctx, W - 180, band + 160, snow && snow.kg > 0 ? `${snow.kg}kg` : "ソロ", font);
  }

  // いちばん下の帯: ハッシュタグとひとこと
  ctx.fillStyle = "rgba(255,255,255,0.92)";
  rr(ctx, 30, 1250, W - 60, 74, 37);
  ctx.fill();
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#3f78c8";
  ctx.font = `700 30px ${font}`;
  ctx.fillText("#シマエナGO  #雪かき  #快適な朝", 64, 1288);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#d6e1ea";
  ctx.lineWidth = 3;
  rr(ctx, 640, 1260, 380, 56, 28);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "#29445c";
  ctx.font = `700 26px ${font}`;
  ctx.fillText("🔗 シマエナGOで、いっしょに ›", 664, 1289);
  return new Promise((resolve, reject) => cv.toBlob((x) => (x ? resolve(x) : reject(new Error("画像を作れませんでした"))), "image/jpeg", 0.92));
}

export default function BragShare({
  viewerId,
  before,
  after,
  minutes,
  page,
  snow,
  cardId,
}: {
  viewerId: string;
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
  const cardLine = cardId ? "限定オリジナルカードも貰った🎴\n" : "";
  const text = `玄関前の雪、${minutes}分でキレイにしました！⛄\n${kgLine}${cardLine}Before → After\n#シマエナGO #雪かき #快適な朝`;
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

  // SNS に出す前に、AI でナンバー・表札・顔・家をぼかす（spec v1.11）。2枚とも終わるまで画像は作らない
  const [blurredPair, setBlurredPair] = useState<{ key: string; before: string; after: string; note: string } | null>(null);
  const pairKey = `${before}|${after}`;
  const safe = blurredPair?.key === pairKey ? blurredPair : null; // 写真が変わったら、前のぼかしは使わない
  useEffect(() => {
    let alive = true;
    const urls: string[] = [];
    const one = async (src: string) => {
      const r = await blurPrivate(await (await fetch(src)).blob(), viewerId);
      const u = URL.createObjectURL(r.blob);
      urls.push(u);
      return { u, note: blurNote(r.result) };
    };
    Promise.all([one(before), one(after)])
      .then(([b, a]) => alive && setBlurredPair({ key: `${before}|${after}`, before: b.u, after: a.u, note: [...new Set([b.note, a.note])].join("／") }))
      .catch(() => alive && setMsg("ぼかしを入れられませんでした。もう一度開いてください。"));
    return () => {
      alive = false;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [before, after, viewerId]);

  // snow は毎回新しい物になるので、中の数字だけで作り直しを決める
  const snowKg = snow?.kg;
  const snowCmp = snow?.comparison;
  useEffect(() => {
    let u: string | null = null;
    if (!safe) return;
    compose(safe.before, safe.after, minutes, snowKg && snowCmp ? { kg: snowKg, comparison: snowCmp } : undefined, cardSrc)
      .then((blob) => {
        u = URL.createObjectURL(blob);
        setFile(new File([blob], "shimaena-go-before-after.jpg", { type: "image/jpeg" }));
        setUrl(u);
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "画像を作れませんでした"));
    return () => {
      if (u) URL.revokeObjectURL(u);
    };
  }, [safe, minutes, snowKg, snowCmp, cardSrc]);

  const share = async () => {
    if (!file) return;
    setMsg(null);
    try {
      const link = page ?? `${window.location.origin}/public/share/today?via=sns`;
      const both = cardFile ? [file, cardFile] : [file];
      if (typeof navigator.canShare === "function" && navigator.canShare({ files: both })) {
        await navigator.share({ files: both, text: `${text}\n${link}` });
        play("share");
        setMsg(both.length > 1 ? "Before/After とカードの2枚を共有しました" : "共有しました");
      } else if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text}\n${link}` });
        play("share");
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

  // 1画面に収めるため、画像は左に小さく、ボタンは右に（11/5 本人の指示「基本1画面」）。押すと大きな画像のまま投稿・保存する
  return (
    <div className="pop-late space-y-2 rounded-2xl bg-card p-3 ring-2 ring-lamp" aria-label="Before と After を自慢する">
      <p className="text-base font-bold">📸 Before→After を自慢しよう！</p>
      <div className="flex gap-2">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="雪かきの前と後の写真と、どけた雪の量" className="aspect-[4/5] w-24 shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="grid aspect-[4/5] w-24 shrink-0 place-items-center rounded-xl bg-paper p-1 text-center text-sm">{safe ? "画像をつくっています…" : "🔍 AI がナンバー・表札・顔・家をぼかしています…"}</div>
        )}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
          <button type="button" disabled={!file} onClick={share} className="btn btn-lamp w-full rounded-full px-2 text-lg leading-tight">
            SNS に投稿する
          </button>
          <button type="button" disabled={!file} onClick={save} className="btn btn-white w-full px-2 text-base">
            画像を保存する
          </button>
        </div>
      </div>
      {msg && (
        <p className="text-sm" role="status">
          {msg}
        </p>
      )}
      {safe && <p className="text-sm font-bold">🫥 {safe.note}</p>}
      <p className="text-xs text-ink-soft">{cardId ? "カードも一緒に渡します。" : ""}AI のぼかしにも漏れはあります。表札・番地・車のナンバーが見えていないか確かめてから投稿してね。自動では投稿しません。</p>
    </div>
  );
}
