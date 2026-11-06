// 使い方: npm run build のあと node scripts/tenken.cjs            （全ページ）
//          node scripts/tenken.cjs "/map?as=h3,/chat?as=h3"   （ページを選ぶ）
// 点検ループ（docs/tenken.md）の「機械の目」。本番ビルドを起動し、スマホ幅で全ページを開いて、
// 人が見なくても分かる不具合を数える。結果は .tenken/report.json と .tenken/report.md、画面は .tenken/*.png。
//   1. はみ出し: 390x844 / 375x667 で縦スクロールが出ていないか（基本1画面の約束）
//   2. エラー: ブラウザの console.error / ページの例外 / 4xx・5xx の読み込み
//   3. 意味不明の候補: 画面に undefined・NaN・[object Object]・TODO・null が出ていないか
//   4. 読みにくさ: 20文字以上の本文が 16px より小さくないか（本文 18px 以上の約束）
//   5. 押しにくさ: ボタン・リンクの高さが 32px より小さくないか（/admin は運営者用なので 4・5 は見ない）
// 終了コードは、1・2・3 がひとつでもあれば 1（4・5 は注意として出すだけ）。
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const root = process.cwd();
const PORT = Number(process.env.PORT || 3127);
const U = `http://localhost:${PORT}`;
const OUT = path.join(root, ".tenken");
const DEFAULT_PAGES = [
  "/?as=h3", "/map?as=h3", "/solo?as=h3", "/chat?as=h3", "/connect?as=h3", "/nakama?as=h3",
  "/cards?as=h3", "/cards/book?as=h3", "/team?as=h3", "/badge?as=h3", "/settings?as=h3",
  "/ask?as=r2", "/start", "/login", "/rules", "/public/town", "/public/diagnosis", "/admin",
];
const pages = (process.argv[2] ? process.argv[2].split(",") : DEFAULT_PAGES).map((p) => p.trim()).filter(Boolean);
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 375, height: 667 }];
const BAD_TEXT = /\b(undefined|NaN|null|TODO|FIXME)\b|\[object Object\]/;

const fileName = (p) => (p.replace(/\?.*$/, "") === "/" ? "top" + p.slice(1).replace(/[?&=]/g, "-") : p.replace(/[?&=]/g, "-").replace(/\//g, "_").replace(/^_/, ""));

async function waitForServer(ms = 60000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(U)).status < 500) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("サーバーが起動しませんでした（npm run build は済んでいますか）");
}

// ページの中で測る（ブラウザ側で動く）
function measure() {
  const vh = window.innerHeight;
  const doc = document.documentElement.scrollHeight;
  let inner = 0;
  for (const el of document.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    if (/(auto|scroll)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 4) inner = Math.max(inner, el.scrollHeight - el.clientHeight);
  }
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
  };
  const badText = [];
  const smallText = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const t = n.textContent.replace(/\s+/g, " ").trim();
    if (!t) continue;
    const el = n.parentElement;
    if (!el || ["SCRIPT", "STYLE", "NOSCRIPT", "TEXTAREA"].includes(el.tagName) || !visible(el)) continue;
    if (/\b(undefined|NaN|null|TODO|FIXME)\b|\[object Object\]/.test(t)) badText.push(t.slice(0, 80));
    const px = parseFloat(getComputedStyle(el).fontSize);
    if (t.length >= 20 && px < 16) smallText.push({ px, text: t.slice(0, 40) });
  }
  const smallTap = [];
  for (const el of document.querySelectorAll("button, a[href], [role=button], input[type=submit]")) {
    if (!visible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.height < 32 || Math.min(r.width, r.height) < 24) smallTap.push({ w: Math.round(r.width), h: Math.round(r.height), text: (el.innerText || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 30) });
  }
  const title = document.title;
  return { over: doc - vh, inner, badText: [...new Set(badText)].slice(0, 10), smallText: smallText.slice(0, 10), smallTap: smallTap.slice(0, 10), title };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const server = spawn(path.join(root, "node_modules/.bin/next"), ["start", "-p", String(PORT)], { cwd: root, stdio: "ignore", detached: true });
  const results = [];
  try {
    await waitForServer();
    const browser = await chromium.launch();
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
      for (const p of pages) {
        const r = { page: p, viewport: `${vp.width}x${vp.height}`, consoleErrors: [], pageErrors: [], badRequests: [] };
        const onConsole = (m) => { if (m.type() === "error") r.consoleErrors.push(m.text().slice(0, 200)); };
        const onError = (e) => r.pageErrors.push(String(e.message || e).slice(0, 200));
        const onResponse = (res) => { if (res.status() >= 400 && !/favicon/.test(res.url())) r.badRequests.push(`${res.status()} ${res.url().replace(U, "")}`.slice(0, 160)); };
        page.on("console", onConsole); page.on("pageerror", onError); page.on("response", onResponse);
        try {
          const res = await page.goto(U + p, { waitUntil: "networkidle", timeout: 30000 });
          r.status = res ? res.status() : 0;
          await page.waitForTimeout(800);
          Object.assign(r, await page.evaluate(measure));
          if (vp.width === 390) await page.screenshot({ path: path.join(OUT, fileName(p) + ".png"), fullPage: true });
        } catch (e) {
          r.pageErrors.push("開けませんでした: " + String(e.message || e).slice(0, 160));
        }
        page.off("console", onConsole); page.off("pageerror", onError); page.off("response", onResponse);
        r.consoleErrors = [...new Set(r.consoleErrors)].slice(0, 5);
        r.badRequests = [...new Set(r.badRequests)].slice(0, 5);
        results.push(r);
      }
      await page.close();
    }
    await browser.close();
  } finally {
    try { process.kill(-server.pid, "SIGTERM"); } catch {}
  }

  // まとめ
  const problems = []; // 直すべきもの
  const notes = []; // 注意（人が見て判断）
  for (const r of results) {
    const where = `${r.page}（${r.viewport}）`;
    if (r.status && r.status >= 400) problems.push(`${where}: ページが ${r.status} を返した`);
    if (r.over > 0) problems.push(`${where}: 縦に ${r.over}px はみ出している（基本1画面）`);
    for (const e of r.pageErrors) problems.push(`${where}: ページの例外 ${e}`);
    for (const e of r.consoleErrors) problems.push(`${where}: console.error ${e}`);
    for (const e of r.badRequests) problems.push(`${where}: 読み込み失敗 ${e}`);
    for (const t of r.badText || []) problems.push(`${where}: 画面に「${t}」が出ている`);
    if (r.viewport === "390x844" && !r.page.startsWith("/admin")) {
      for (const t of r.smallText || []) notes.push(`${r.page}: 本文 ${t.px}px「${t.text}…」（18px 以上の約束）`);
      for (const t of r.smallTap || []) notes.push(`${r.page}: 小さいボタン ${t.w}x${t.h}「${t.text}」`);
      if (r.inner > 0) notes.push(`${r.page}: 中でスクロールする部分が ${r.inner}px（タブ分けか中身を減らす候補）`);
    }
  }
  const md = [
    `# 機械の目の点検（${new Date().toISOString()}）`,
    "",
    `ページ ${pages.length} × 画面 ${VIEWPORTS.length}。直すべきもの ${problems.length}、注意 ${notes.length}。画面は .tenken/*.png`,
    "",
    "## 直すべきもの",
    ...(problems.length ? problems.map((s) => `- ${s}`) : ["- なし"]),
    "",
    "## 注意（人が見て判断）",
    ...(notes.length ? notes.map((s) => `- ${s}`) : ["- なし"]),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify({ at: new Date().toISOString(), pages, results, problems, notes }, null, 2));
  fs.writeFileSync(path.join(OUT, "report.md"), md);
  console.log(md);
  if (problems.length > 0) process.exitCode = 1;
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
