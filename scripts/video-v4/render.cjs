// 合成ページ（compose.html）を1コマずつ撮る。
// 使い方:
//   node scripts/video-v4/render.cjs preview 3,12.5,40     … その秒のコマを .video/v4/preview/ に PNG で（確かめ用）
//   node scripts/video-v4/render.cjs sheet 0,60,12          … 0〜60 秒から 12 コマを1枚に並べる（.video/v4/preview/sheet-0-60.jpg）
//   node scripts/video-v4/render.cjs all [from] [to]        … 全コマ（または from〜to 秒）を .video/v4/out/%05d.jpg に
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const V = path.join(ROOT, ".video/v4");
const HTML = path.join(__dirname, "compose.html");
const TL = JSON.parse(fs.readFileSync(path.join(V, "timeline.json"), "utf8"));
const cmd = process.argv[2] || "all";

async function shots(times, outDir, workers = Math.min(4, os.cpus().length)) {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ args: ["--allow-file-access-from-files", "--hide-scrollbars"] });
  let done = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: Math.min(workers, times.length) }, async (_, w) => {
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    p.on("pageerror", (e) => console.error("page error:", e.message));
    p.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text().slice(0, 300)); });
    await p.goto("file://" + HTML + "?render=1");
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(600);
    for (let i = w; i < times.length; i += workers) {
      const [t, file] = times[i];
      await p.evaluate((t) => seek(t), t);
      await p.screenshot({ path: path.join(outDir, file), type: file.endsWith(".png") ? "png" : "jpeg", quality: file.endsWith(".png") ? undefined : 94, clip: { x: 0, y: 0, width: 1920, height: 1080 } });
      if (++done % 300 === 0) console.log(`${done}/${times.length}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
  }));
  await b.close();
}

(async () => {
  if (cmd === "preview") {
    const list = (process.argv[3] || "1").split(",").map(Number);
    await shots(list.map((t) => [t, `t${t.toFixed(2).replace(".", "_")}.png`]), path.join(V, "preview"), 3);
    console.log("preview:", path.join(V, "preview"));
  } else if (cmd === "sheet") {
    const [a, bEnd, n] = (process.argv[3] || `0,${TL.seconds},12`).split(",").map(Number);
    const cols = Number(process.argv[4] || 4);
    const dir = path.join(V, "preview/sheet"); fs.rmSync(dir, { recursive: true, force: true });
    const times = Array.from({ length: n }, (_, i) => a + ((bEnd - a) * (i + 0.5)) / n);
    await shots(times.map((t, i) => [t, String(i).padStart(3, "0") + ".jpg"]), dir, 4);
    const out = path.join(V, `preview/sheet-${Math.round(a)}-${Math.round(bEnd)}.jpg`);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", path.join(dir, "%03d.jpg"), "-vf", `scale=960:-1,tile=${cols}x${Math.ceil(n / cols)}`, "-frames:v", "1", "-q:v", "3", out]);
    console.log(out, times.map((t) => t.toFixed(1)).join(" "));
  } else {
    const from = Number(process.argv[3] || 0), to = Number(process.argv[4] || TL.seconds);
    const out = path.join(V, "out"); fs.mkdirSync(out, { recursive: true });
    const N = Math.round(TL.fps * TL.seconds);
    const times = [];
    for (let i = Math.round(from * TL.fps); i < Math.min(N, Math.round(to * TL.fps)); i++) times.push([i / TL.fps, String(i).padStart(5, "0") + ".jpg"]);
    await shots(times, out);
    console.log("コマ:", times.length, "/", N);
  }
})().catch((e) => { console.error(e); process.exit(1); });
