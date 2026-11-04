// 写真のぼかし（spec v1.11、ブラウザ専用）。Claude が見つけた場所（ナンバー・表札・顔・家・住所の表示）を、
// 小さく縮めてから引き伸ばす方法で強くぼかす（iPhone の Safari でも同じ見た目になるよう、canvas の filter は使わない）。
// 確かめられなかった写真は全体をぼかす。
import { privacyAction } from "@/app/solo/actions";
import type { PrivacyBox, PrivacyResult } from "@/lib/claude/privacy";

/** 1か所をぼかす。細かさ = 箱の短い辺を何マスにするか（小さいほど強い） */
function smear(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, cells: number) {
  if (w < 2 || h < 2) return;
  const s = Math.max(1, Math.min(w, h) / cells);
  const tw = Math.max(1, Math.round(w / s));
  const th = Math.max(1, Math.round(h / s));
  const tmp = document.createElement("canvas");
  tmp.width = tw;
  tmp.height = th;
  const t = tmp.getContext("2d")!;
  t.imageSmoothingEnabled = true;
  t.drawImage(ctx.canvas, x, y, w, h, 0, 0, tw, th);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "low";
  ctx.drawImage(tmp, 0, 0, tw, th, x, y, w, h);
  ctx.restore();
}

/** canvas に描いた写真をぼかす（2回重ねて、モザイクより柔らかいぼかしにする） */
export function blurCanvas(ctx: CanvasRenderingContext2D, r: PrivacyResult) {
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  const boxes: PrivacyBox[] = r.whole ? [{ kind: "house", x: 0, y: 0, w: 1, h: 1 }] : r.boxes;
  for (const b of boxes) {
    const x = Math.floor(b.x * W);
    const y = Math.floor(b.y * H);
    const w = Math.ceil(b.w * W);
    const h = Math.ceil(b.h * H);
    const cells = r.whole ? 14 : 6;
    smear(ctx, x, y, w, h, cells);
    smear(ctx, x, y, w, h, cells * 2);
  }
}

/** 写真（Blob）→ Claude にぼかす場所を聞く → ぼかした JPEG */
export async function blurPrivate(photo: Blob, viewerId: string): Promise<{ blob: Blob; result: PrivacyResult }> {
  const fd = new FormData();
  fd.set("viewerId", viewerId);
  fd.set("photo", new File([photo], "p.jpg", { type: photo.type || "image/jpeg" }));
  const result: PrivacyResult = await privacyAction(fd).catch(() => ({ boxes: [], whole: true }));
  const bmp = await createImageBitmap(photo);
  const cv = document.createElement("canvas");
  cv.width = bmp.width;
  cv.height = bmp.height;
  const ctx = cv.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0);
  blurCanvas(ctx, result);
  const blob = await new Promise<Blob>((resolve, reject) =>
    cv.toBlob((b) => (b ? resolve(b) : reject(new Error("ぼかしを入れられませんでした"))), "image/jpeg", 0.85),
  );
  return { blob, result };
}

const LABEL: Record<PrivacyBox["kind"], string> = { plate: "ナンバー", nameplate: "表札", face: "顔", house: "家", address: "住所の表示" };

/** 「ぼかしを入れたもの」の短い説明（例: ナンバー・顔をぼかしました） */
export function blurNote(r: PrivacyResult): string {
  if (r.whole) return "写真全体をぼかしました（AI で確かめられなかったため）";
  const kinds = [...new Set(r.boxes.map((b) => LABEL[b.kind]))];
  return kinds.length > 0 ? `${kinds.join("・")}をぼかしました` : "ぼかすものは見つかりませんでした";
}
