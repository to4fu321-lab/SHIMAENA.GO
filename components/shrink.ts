// スマホの写真はそのままだと大きいので、送る前に長辺 1024px（max）の JPEG に縮める（ブラウザ専用）。写真の確認（Claude）には十分で、送る量は 1MB の上限より小さくなる
export async function shrink(file: File, max = 1024): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("写真を縮められませんでした"))), "image/jpeg", 0.8),
  );
}

// アイコン用（11/7 本人の指示「自分の画像を基本で」）: まん中を正方形に切り取り、size px の JPEG の data URL にする。保存しても 20KB くらい
export async function squarePhoto(file: File, size = 160): Promise<string> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.8);
}
