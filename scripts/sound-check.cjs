// 使い方: node scripts/sound-check.cjs
// 本番ビルドを起動し、音が「いつ・何が」予約されるかを Playwright で確かめる（耳で聞く代わり）。
// AudioContext の start() を数え、<html data-bgm> でいま鳴っている曲を見る。
const { spawn } = require("child_process");
const path = require("path");
const { chromium } = require("playwright");

const PORT = 3125;
const ok = (cond, msg) => {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) process.exitCode = 1;
};
async function waitForServer(url, ms = 40000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("サーバーが起動しませんでした");
}

(async () => {
  const server = spawn(path.join("node_modules", ".bin", "next"), ["start", "-p", String(PORT)], { stdio: "ignore", detached: true });
  try {
    await waitForServer(`http://localhost:${PORT}/`);
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => {
      // 予約した音源の数（osc＝音、noise＝ノイズ）と、AudioContext の状態を見えるように
      window.__sound = { osc: 0, noise: 0, ctx: null };
      const Orig = window.AudioContext;
      window.AudioContext = class extends Orig {
        constructor(...a) {
          super(...a);
          window.__sound.ctx = this;
        }
        createOscillator() {
          const o = super.createOscillator();
          const s = o.start.bind(o);
          o.start = (t) => {
            window.__sound.osc++;
            return s(t);
          };
          return o;
        }
        createBufferSource() {
          const o = super.createBufferSource();
          const s = o.start.bind(o);
          o.start = (t) => {
            window.__sound.noise++;
            return s(t);
          };
          return o;
        }
      };
    });
    const counts = () => page.evaluate(() => ({ osc: window.__sound.osc, noise: window.__sound.noise, state: window.__sound.ctx?.state, bgm: document.documentElement.dataset.bgm ?? null }));
    const home = `http://localhost:${PORT}/?as=h1`;

    // 1. 開いただけでは鳴らない（スマホの決まり）。最初のタップで解放され、BGM「しらかばの朝」が始まる
    await page.goto(home, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    let c = await counts();
    ok(c.bgm === null && c.osc === 0, `開いただけでは鳴らない（音源 ${c.osc}）`);
    await page.getByRole("button", { name: /シマエナ隊長/ }).click();
    await page.waitForTimeout(700);
    c = await counts();
    ok(c.state === "running", `最初のタップで AudioContext が動く（${c.state}）`);
    ok(c.bgm === "morning", `ホームの BGM は「しらかばの朝」（${c.bgm}）`);
    if (c.bgm !== "morning") console.log("  debug:", JSON.stringify(await page.evaluate(() => window.__bgmDebug)));
    const before = c.osc;
    await page.waitForTimeout(3200); // 「しらかばの朝」の1小節は約 2.9 秒。次の小節が予約されるまで待つ
    c = await counts();
    ok(c.osc > before + 10, `BGM が先読みで予約され続ける（3.2秒で +${c.osc - before} 音）`);

    // 2. 下のタブで地図へ: 同じ「しらかばの朝」のまま（出発前）
    await page.getByRole("link", { name: "地図" }).click();
    await page.waitForURL(/\/map/);
    await page.waitForTimeout(1200);
    c = await counts();
    ok(c.bgm === "morning", `地図（出発前）も「しらかばの朝」（${c.bgm}）`);

    // 3. 雪かき中の印 /badge は「出撃！」
    await page.goto(`http://localhost:${PORT}/badge?as=h1`, { waitUntil: "networkidle" });
    await page.mouse.click(10, 10);
    await page.waitForTimeout(1200);
    c = await counts();
    ok(c.bgm === "mission", `雪かき中の印は「出撃！」（${c.bgm}）`);

    // 4. 設定で BGM をオフ → 止まる。オンに戻す → 戻る
    await page.goto(`http://localhost:${PORT}/settings?as=h1`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "音" }).click();
    await page.waitForTimeout(600);
    await page.getByRole("switch", { name: /BGM/ }).click();
    await page.waitForTimeout(300);
    c = await counts();
    ok(c.bgm === null, `BGM をオフにすると止まる（${c.bgm}）`);
    await page.getByRole("switch", { name: /BGM/ }).click();
    await page.waitForTimeout(600);
    c = await counts();
    ok(c.bgm === "morning", `オンに戻すと「しらかばの朝」（${c.bgm}）`);

    // 5. ボタンの音: 主役（ピポッ）と白いボタン（プッ）で音が出る
    const b0 = (await counts()).osc;
    await page.getByRole("link", { name: "ホームへ戻る" }).click();
    await page.waitForTimeout(200);
    ok((await counts()).osc > b0, "白いボタンでタップ音");

    await browser.close();
  } finally {
    try {
      process.kill(-server.pid);
    } catch {}
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
