// デモ動画の「動く画面」を本番ビルドから録画する（Playwright の動画録画、390×844）。
// 使い方: faketime -f '+4h' node scripts/demo-video/record.cjs [出力フォルダ=.video/rec]
//   先に `npm run build`。サーバーは自分で起動する（PORT 3131）。
//   夜（日本時間 19〜6 時）はよその家に行けないので、朝の時間帯でなければ faketime で時計をずらして実行する。
// 出力: <出力>/<scene>.webm と <出力>/scenes.json（各シーンの長さと、押した瞬間の秒）。
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.resolve(process.argv[2] || path.join(ROOT, ".video/rec"));
const PORT = 3131;
const B = `http://localhost:${PORT}`;
const VP = { width: 390, height: 844 };
fs.mkdirSync(OUT, { recursive: true });

// 玄関前の写真（架空。雪の白と、戸口の茶色だけの絵）
const PHOTO = path.join(OUT, "door.jpg");

async function waitForServer() {
  const end = Date.now() + 60000;
  while (Date.now() < end) {
    try { const r = await fetch(B + "/"); if (r.status < 500) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("サーバーが起動しませんでした");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const scenes = {};

(async () => {
  const server = spawn(path.join(ROOT, "node_modules/.bin/next"), ["start", "-p", String(PORT)], { stdio: "ignore", detached: true, cwd: ROOT });
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"] });
  try {
    await waitForServer();
    // 操作用（録画しない）のページ: /admin のボタンを押す・架空の人として押す
    const opCtx = await browser.newContext({ viewport: VP });
    const op = await opCtx.newPage();
    const admin = async (label, tab) => {
      await op.goto(B + "/admin", { waitUntil: "networkidle" });
      if (tab) { await op.getByRole("tab", { name: tab }).click(); await sleep(400); }
      await op.getByRole("button", { name: label }).click();
      await sleep(2500);
    };

    // 録画つきのシーン。fn には page と mark(名前) が渡る。mark は「押した瞬間」を秒で記録する。
    const record = async (name, fn) => {
      const ctx = await browser.newContext({ viewport: VP, permissions: ["microphone"], recordVideo: { dir: OUT, size: VP } });
      const page = await ctx.newPage();
      const t0 = Date.now();
      const marks = {};
      const mark = (k) => { marks[k] = +((Date.now() - t0) / 1000).toFixed(2); console.log(`  ${name}: ${k} @ ${marks[k]}s`); };
      await fn(page, mark);
      const seconds = +((Date.now() - t0) / 1000).toFixed(2);
      const video = page.video();
      await ctx.close();
      const tmp = await video.path();
      const file = path.join(OUT, `${name}.webm`);
      fs.renameSync(tmp, file);
      scenes[name] = { file: path.basename(file), seconds, marks };
      console.log(`録画: ${name} ${seconds}s`);
    };
    const open = async (page, u) => { await page.goto(B + u, { waitUntil: "networkidle" }); await sleep(1200); };
    const scrollTo = async (page, sel, y, ms) => page.evaluate(([sel, y, ms]) => new Promise((done) => {
      const el = sel ? document.querySelector(sel) : document.scrollingElement;
      const from = el.scrollTop, start = performance.now();
      const step = (t) => { const k = Math.min(1, (t - start) / ms); el.scrollTop = from + (y - from) * (1 - Math.cos(k * Math.PI)) / 2; if (k < 1) requestAnimationFrame(step); else done(); };
      requestAnimationFrame(step);
    }), [sel, y, ms]);

    // 0) 朝をまっさらに（前夜の予告）→ ホームとお願い登録を撮る
    await admin("0 前夜の予告");

    await record("home", async (p, mark) => {
      await open(p, "/?as=h1");
      await sleep(2500);
      mark("tap");
      await p.getByRole("button", { name: /シマエナ隊長/ }).click();
      await sleep(4500);
    });

    await record("ask", async (p, mark) => {
      await open(p, "/ask?as=r7");
      await sleep(1800);
      mark("omakase"); await p.getByRole("button", { name: /おまかせ/ }).click(); await sleep(1800);
      mark("genkan"); await p.locator("button", { hasText: "玄関前" }).first().click(); await sleep(1800);
      mark("photo"); await p.getByRole("button", { name: /写真を撮って自動で決める/ }).hover(); await sleep(2500);
    });

    // 1) 6:30 積もった → 3) 司令官の作戦（2 は押さない: 架空の人に担当が付いて「助けて」が減る）
    await admin("1 6:30");
    await admin("3 6:40");

    // 隊長トーク（A 田中さん）: おはよう → 助けてほしい家 → 「行く（10分でも）」
    await record("chat", async (p, mark) => {
      await open(p, "/chat?as=h1");
      const list = await p.evaluate(() => { const els = [...document.querySelectorAll("*")].filter((e) => e.scrollHeight > e.clientHeight + 40 && getComputedStyle(e).overflowY !== "visible"); return els.length ? "" : null; });
      // いちばん上から、ゆっくり下へ
      await p.evaluate(() => { const e = [...document.querySelectorAll("*")].find((e) => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)); if (e) e.scrollTop = 0; });
      await sleep(1500);
      mark("scroll");
      await p.evaluate(() => new Promise((done) => { const e = [...document.querySelectorAll("*")].find((e) => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)); if (!e) return done(); const to = e.scrollHeight - e.clientHeight, from = 0, start = performance.now(), ms = 4500; const step = (t) => { const k = Math.min(1, (t - start) / ms); e.scrollTop = from + (to - from) * (1 - Math.cos(k * Math.PI)) / 2; if (k < 1) requestAnimationFrame(step); else done(); }; requestAnimationFrame(step); }));
      await sleep(1200);
      mark("go");
      const goBtns = p.getByRole("button", { name: /行く（10分でも）/ });
      // 拠点7（小林さん）の「行く」
      const n = await goBtns.count();
      let target = goBtns.last();
      for (let i = 0; i < n; i++) { const b = goBtns.nth(i); const near = await b.evaluate((el) => el.closest("div")?.parentElement?.innerText || ""); if (/拠点7/.test(near)) { target = b; break; } }
      await target.click();
      await sleep(5000);
      void list;
    });

    // B（そうたさん・別チーム）も拠点7へ（録画しない）
    await open(op, "/chat?as=h11");
    {
      const goBtns = op.getByRole("button", { name: /行く（10分でも）/ });
      const n = await goBtns.count();
      let target = goBtns.last();
      for (let i = 0; i < n; i++) { const b = goBtns.nth(i); const near = await b.evaluate((el) => el.closest("div")?.parentElement?.innerText || ""); if (/拠点7/.test(near)) { target = b; break; } }
      await target.click();
      await sleep(3000);
    }

    // 地図（A）: 拠点7 に2チームが集まる → ほかの家が次々に完了（/admin の 4）
    await record("map", async (p, mark) => {
      await open(p, "/map?as=h1");
      await sleep(2500);
      mark("done1"); await admin("4 1軒、完了にする"); await sleep(1500);
      mark("done2"); await admin("4 1軒、完了にする"); await sleep(1500);
      mark("done3"); await admin("4 1軒、完了にする"); await sleep(3000);
    });

    // 写真で「終わりました」→ MISSION CLEAR → カード
    await record("finish", async (p, mark) => {
      await open(p, "/map?as=h1");
      await sleep(1500);
      mark("finish");
      const [chooser] = await Promise.all([p.waitForEvent("filechooser"), p.getByRole("button", { name: "終わりました" }).click()]);
      await chooser.setFiles(PHOTO);
      await p.getByText(/あなたの10分で/).waitFor({ timeout: 30000 });
      mark("clear");
      await sleep(4500);
      mark("card");
      await p.getByRole("button", { name: /カードを見る/ }).click();
      await sleep(5500);
    });

    // 家の人（C 小林さん）: 「終わりました」の知らせ → 🎤 声でありがとう → 吹き込む → 届ける
    await record("thanks", async (p, mark) => {
      await open(p, "/chat?as=r7");
      await sleep(2000);
      mark("mic");
      await p.getByRole("link", { name: /声でありがとう/ }).first().click();
      await p.waitForLoadState("networkidle");
      await sleep(1500);
      mark("talk");
      await p.getByRole("button", { name: /押して話す/ }).click();
      await sleep(7500); // 娘さんの声（約 7 秒）
      mark("stop");
      await p.getByRole("button", { name: /とめる/ }).click();
      await sleep(1500);
      mark("send");
      await p.getByRole("button", { name: /届ける/ }).click();
      await sleep(3000);
    });

    // 手伝った人（A）: 声のありがとうが届く → 聞く
    await record("listen", async (p, mark) => {
      await open(p, "/chat?as=h1");
      await sleep(2000);
      mark("listen");
      await p.getByRole("link", { name: /声を聞く/ }).last().click();
      await p.waitForLoadState("networkidle");
      await sleep(1000);
      mark("play");
      await p.locator("audio").evaluate((a) => a.play().catch(() => {}));
      await sleep(5000);
    });

    // 隊長に相談（文字を打つ → 返事）→ 🌐 English
    await record("consult", async (p, mark) => {
      await open(p, "/chat?as=h1");
      await sleep(1200);
      mark("type");
      await p.getByPlaceholder("隊長に話す").pressSequentially("近所の人と知り合いたい", { delay: 90 });
      await sleep(500);
      mark("send");
      await p.getByRole("button", { name: "送る" }).click();
      await p.getByText(/はどうですか/).waitFor({ timeout: 30000 }).catch(() => {});
      mark("reply");
      await sleep(3500);
      mark("lang");
      await p.getByRole("button", { name: "ことば / Language" }).click();
      await sleep(1200);
      mark("english");
      await p.getByRole("button", { name: /English/ }).click();
      await sleep(3500);
    });

    // 高齢者が教える側に: 聞き書き → 町の週刊絵本（デモの種を入れてから）
    await admin("デモの聞き書きを1件入れる", "ほか");
    await admin("今週の絵本を作る", "ほか");
    await record("book", async (p, mark) => {
      await open(p, "/kikigaki?as=h1");
      await sleep(3500);
      mark("book");
      await open(p, "/book?as=h1");
      await sleep(2500);
      mark("read");
      const read = p.getByRole("button", { name: /読む/ });
      if (await read.count()) { await read.first().click(); await sleep(2500); const next = p.getByRole("button", { name: /›|次/ }); if (await next.count()) { await next.first().click(); await sleep(2500); } }
      await sleep(1500);
    });

    // 締め: ホームの3羽
    await record("home-end", async (p) => {
      await open(p, "/?as=h1");
      await sleep(5000);
    });

    // 静止画（2倍）: 3羽のアップ用・カード用
    const still = await browser.newContext({ viewport: VP, deviceScaleFactor: 2 });
    const sp = await still.newPage();
    await open(sp, "/?as=h1"); await sp.screenshot({ path: path.join(OUT, "still-home.png") });
    await open(sp, "/cards/book?as=h1"); await sp.screenshot({ path: path.join(OUT, "still-card.png") });
    await still.close();

    fs.writeFileSync(path.join(OUT, "scenes.json"), JSON.stringify(scenes, null, 1));
    console.log("できた:", path.join(OUT, "scenes.json"));
  } finally {
    await browser.close();
    try { process.kill(-server.pid, "SIGTERM"); } catch {}
  }
})().catch((e) => { console.error(e); process.exit(1); });
