// 使い方: node scripts/shot.cjs /map [/admin ...]
// 本番ビルドを起動し、スマホ幅（390x844）でスクショを .shots/ に保存する。
// ループが自分の作った画面を目で確認するための道具。
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const PORT = 3123;
const paths = process.argv.slice(2);
if (paths.length === 0) paths.push("/");

async function waitForServer(url, ms = 30000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok || r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("サーバーが起動しませんでした");
}

(async () => {
  fs.mkdirSync(".shots", { recursive: true });
  const server = spawn("npx", ["next", "start", "-p", String(PORT)], { stdio: "ignore" });
  try {
    await waitForServer(`http://localhost:${PORT}/`);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    for (const p of paths) {
      await page.goto(`http://localhost:${PORT}${p}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const file = path.join(".shots", (p === "/" ? "top" : p.replace(/\//g, "_").replace(/^_/, "")) + ".png");
      await page.screenshot({ path: file, fullPage: true });
      console.log("保存:", file);
    }
    await browser.close();
  } finally {
    server.kill();
  }
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
