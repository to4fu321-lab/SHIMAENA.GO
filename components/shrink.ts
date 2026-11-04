// スマホの写真はそのままだと大きいので、送る前に長辺 1280px（max）の JPEG に縮める（ブラウザ専用）
export async function shrink(file: File, max = 1280): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("写真を縮められませんでした"))), "image/jpeg", 0.85),
  );
}
