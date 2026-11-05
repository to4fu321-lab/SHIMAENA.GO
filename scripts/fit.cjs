// 使い方: npm run build のあと node scripts/fit.cjs "/nakama?as=h3,/team?as=h3"
// スマホ 390x844 と 375x667 で、ページが1画面に収まっているか（over=はみ出し px、innerScroll=中でスクロールする量）を出す。
const { spawn } = require("child_process");
const path = require("path");
const root = process.cwd();
const { chromium } = require("playwright");
const PORT = 3125, U = `http://localhost:${PORT}`;
const pages = (process.argv[2] || "/?as=h3,/map?as=h3,/solo?as=h3,/nakama?as=h3,/cards?as=h3,/cards/book?as=h3,/team?as=h3,/today?as=h3,/badge?as=h3,/settings?as=h3,/rules,/public/town,/public/diagnosis").split(",");
(async () => {
  const server = spawn(path.join(root, "node_modules/.bin/next"), ["start", "-p", String(PORT)], { cwd: root, stdio: "ignore", detached: true });
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch(U)).status < 500) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
    const b = await chromium.launch();
    for (const vp of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
      const page = await b.newPage({ viewport: vp });
      for (const p of pages) {
        await page.goto(U + p); await page.waitForTimeout(700);
        const h = await page.evaluate(() => {
          let max = document.documentElement.scrollHeight;
          // 中の要素でスクロールするもの（縦）
          let inner = 0;
          for (const el of document.querySelectorAll("*")) { const s = getComputedStyle(el); if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4) inner = Math.max(inner, el.scrollHeight - el.clientHeight); }
          return { doc: max, inner };
        });
        console.log(`${vp.width}x${vp.height} ${p.padEnd(22)} doc=${h.doc} over=${h.doc - vp.height} innerScroll=${h.inner}`);
      }
      await page.close();
    }
    await b.close();
  } finally { try { process.kill(-server.pid); } catch {} }
})();
