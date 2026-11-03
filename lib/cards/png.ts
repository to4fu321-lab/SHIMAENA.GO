// SVG → PNG。LINE の画像メッセージは PNG/JPEG の URL が要るため。
// サーバーに日本語フォントがないので、同梱した Zen Maru Gothic を使う（assets/fonts/、next.config で同梱）。
import { Resvg } from "@resvg/resvg-js";
import path from "node:path";

const FONT_FILES = ["ZenMaruGothic-Bold.ttf", "ZenMaruGothic-Regular.ttf"].map((f) => path.join(process.cwd(), "assets", "fonts", f));

export interface PngOptions {
  /** 出力の幅（px）。高さは SVG の比率で決まる */
  width: number;
}

export async function svgToPng(svg: string, opts: PngOptions): Promise<Uint8Array> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: opts.width },
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: "Zen Maru Gothic" },
  });
  return resvg.render().asPng();
}
