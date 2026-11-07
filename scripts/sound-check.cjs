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
    // 鳴った効果音の名前（engine が document に知らせる）
    await page.addInitScript(() => {
      window.__sfx = [];
      document.addEventListener("shimaena:sfx", (e) => window.__sfx.push(e.detail.name + (e.detail.delay ? `@${e.detail.delay}` : "")));
    });
    const sfx = () => page.evaluate(() => window.__sfx.splice(0));
    const home = `http://localhost:${PORT}/?as=h1`;

    // 1. 開いただけでは鳴らない（スマホの決まり）。最初のタップで解放され、BGM「今朝の雪の歌」（v1.28）が始まる
    await page.goto(home, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    let c = await counts();
    ok(c.bgm === null && c.osc === 0, `開いただけでは鳴らない（音源 ${c.osc}）`);
    await page.getByRole("button", { name: /シマエナ隊長/ }).click();
    await page.waitForTimeout(700);
    c = await counts();
    ok(c.state === "running", `最初のタップで AudioContext が動く（${c.state}）`);
    ok(c.bgm === "morning", `ホームの BGM は「しらかばの朝」（11/7 今朝の歌をホームから外した。${c.bgm}）`);
    if (c.bgm !== "morning") console.log("  debug:", JSON.stringify(await page.evaluate(() => window.__bgmDebug)));
    const before = c.osc;
    await page.waitForTimeout(3200); // 今朝の雪の歌の1小節は 2〜3 秒。次の小節が予約されるまで待つ
    c = await counts();
    ok(c.osc > before + 10, `BGM が先読みで予約され続ける（3.2秒で +${c.osc - before} 音）`);

    // 1b. 別のアプリに移って戻る（11/6 本人の指摘「別のアプリに移動してから再度開くと音が出なくなる」）:
    //     裏に回ると止まり、戻ると続きから鳴る。戻ったのに時計が進まない（iPhone の症状）ときは、次のタップで AudioContext を作り直して鳴り続ける
    const setHidden = (hidden) =>
      page.evaluate((h) => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => h });
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (h ? "hidden" : "visible") });
        document.dispatchEvent(new Event("visibilitychange"));
      }, hidden);
    await setHidden(true);
    await page.waitForTimeout(400);
    c = await counts();
    ok(c.state === "suspended", `裏に回ると止まる（${c.state}）`);
    await setHidden(false);
    await page.waitForTimeout(1200);
    const b1 = (await counts()).osc;
    await page.waitForTimeout(3200);
    c = await counts();
    ok(c.state === "running" && c.osc > b1 + 10 && c.bgm === "morning", `戻ると続きから鳴る（${c.state}・3.2秒で +${c.osc - b1} 音・${c.bgm}）`);
    // 時計が止まったまま戻ったふり → 次のタップで新しい AudioContext になり、BGM が続く
    await page.evaluate(() => {
      const ctx = window.__sound.ctx;
      const frozen = ctx.currentTime;
      Object.defineProperty(ctx, "currentTime", { configurable: true, get: () => frozen });
      window.__oldCtx = ctx;
    });
    await setHidden(true);
    await page.waitForTimeout(300);
    await setHidden(false);
    await page.waitForTimeout(1200);
    await page.keyboard.press("a"); // 人の操作
    await page.waitForTimeout(1500);
    const b2 = (await counts()).osc;
    await page.waitForTimeout(3200);
    c = await counts();
    const rebuilt = await page.evaluate(() => window.__sound.ctx !== window.__oldCtx && window.__oldCtx.state === "closed");
    ok(rebuilt && c.state === "running" && c.osc > b2 + 10 && c.bgm === "morning", `時計が止まっていたら作り直して鳴り続ける（作り直し ${rebuilt}・${c.state}・+${c.osc - b2} 音・${c.bgm}）`);

    // 2. 下のタブで地図へ: 同じ「しらかばの朝」のまま（出発前）
    await page.getByRole("link", { name: "マップ" }).click();
    await page.waitForURL(/\/map/);
    await page.waitForTimeout(1200);
    c = await counts();
    ok(c.bgm === "morning", `地図（出発前）も「しらかばの朝」（${c.bgm}）`);

    // 3. 雪かき中の印 /badge は「出撃！」
    await page.goto(`http://localhost:${PORT}/badge?as=h1`, { waitUntil: "networkidle" });
    await page.keyboard.press("a"); // 人の操作（音の解放）。Shift などの修飾キーは操作に数えられない。画面の端を押すとリンクに当たる
    await page.waitForTimeout(1200);
    c = await counts();
    ok(c.bgm === "mission", `雪かき中の印は「出撃！」（${c.bgm}）`);
    // v1.38: 雪かき中の曲は <audio> で鳴る（書き出しが終わるまで待つ）→ 裏に回しても止まらない
    let bg = null;
    for (let i = 0; i < 40 && bg !== "playing"; i++) {
      await page.waitForTimeout(250);
      bg = await page.evaluate(() => document.documentElement.dataset.bgmBg ?? null);
    }
    ok(bg === "playing", `雪かき中の曲は画面を消しても鳴る <audio> で（${bg}）`);
    await setHidden(true);
    await page.waitForTimeout(800);
    bg = await page.evaluate(() => document.documentElement.dataset.bgmBg ?? null);
    const st = (await counts()).state;
    ok(bg === "playing" && st === "suspended", `裏に回しても雪かき中の曲は止まらない（${bg}・Web Audio は ${st}）`);
    await setHidden(false);
    await page.waitForTimeout(400);

    // 4. 設定で BGM をオフ → 止まる。オンに戻す → 戻る
    await page.goto(`http://localhost:${PORT}/settings?as=h1`, { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: "音" }).click();
    await page.waitForTimeout(600);
    await page.getByRole("switch", { name: /^BGM/ }).click();
    await page.waitForTimeout(300);
    c = await counts();
    ok(c.bgm === null, `BGM をオフにすると止まる（${c.bgm}）`);
    await page.getByRole("switch", { name: /^BGM/ }).click();
    await page.waitForTimeout(600);
    c = await counts();
    ok(c.bgm === "morning", `オンに戻すと「しらかばの朝」（${c.bgm}）`);
    // v1.38: 自分の音楽を聴く → BGM は止まる。戻すと鳴る
    await page.getByRole("switch", { name: /自分の音楽/ }).click();
    await page.waitForTimeout(300);
    c = await counts();
    ok(c.bgm === null, `「自分の音楽を聴く」で BGM が止まる（${c.bgm}）`);
    await page.getByRole("switch", { name: /自分の音楽/ }).click();
    await page.waitForTimeout(600);
    c = await counts();
    ok(c.bgm === "morning", `戻すと BGM が鳴る（${c.bgm}）`);

    // 5. ボタンの音: 主役（ピポッ）と白いボタン（プッ）で音が出る
    const b0 = (await counts()).osc;
    await page.getByRole("link", { name: "ホームへ戻る" }).click();
    await page.waitForTimeout(200);
    ok((await counts()).osc > b0, "白いボタンでタップ音");

    // 6. 場面の効果音: ホームの隊長（ピヨッ＋パタパタ）
    await page.goto(home, { waitUntil: "networkidle" });
    await page.keyboard.press("a"); // 人の操作（音の解放）。Shift などの修飾キーは操作に数えられない。画面の端を押すとリンクに当たる
    await sfx();
    await page.getByRole("button", { name: /シマエナ隊長/ }).click();
    await page.waitForTimeout(200);
    let got = await sfx();
    ok(got.includes("tap") && got.includes("chirp") && got.includes("flap@0.25"), `隊長をタップ: ${got.join(" ")}`);

    // 7. 今週のチーム: ドロロロ → ピロリン（ホームのチームの札からアプリ内で移る。開き直し＝タップ前なら鳴らないのが正しい）
    await sfx();
    await page.getByRole("link", { name: /今週のあなたのチーム/ }).click();
    await page.waitForURL(/\/team/);
    await page.waitForTimeout(500);
    got = await sfx();
    ok(got.includes("drumroll") && got.includes("welcome@0.8"), `チーム発表: ${got.join(" ")}`);

    // 8. 使い方の雪かき: ザクッ×4 → 最後はクリア！
    await page.goto(`http://localhost:${PORT}/rules`, { waitUntil: "networkidle" });
    await page.keyboard.press("a"); // 人の操作（音の解放）。Shift などの修飾キーは操作に数えられない。画面の端を押すとリンクに当たる
    await page.getByRole("button", { name: /4ページ目/ }).click();
    await page.waitForTimeout(900);
    const field = page.getByRole("button", { name: /ひとすくい/ });
    if (await field.count()) {
      await sfx();
      for (let i = 0; i < 5; i++) {
        await field.click();
        await page.waitForTimeout(120);
      }
      got = await sfx();
      ok(got.filter((x) => x === "dig").length === 4 && got.includes("missionClear"), `雪かきの練習: ${got.join(" ")}`);
    } else ok(false, "使い方の雪かきのページに行けなかった");

    // 9. ソロ出動の一本道（自分の家の雪かき）: 出撃！ → ミッション中（BGM 出撃！）→ Before/After の写真（カシャッ）→ クリア！ → 灯り・数え上げ → カード演出の順
    await page.goto(`http://localhost:${PORT}/solo?as=h1&focus=own_house`, { waitUntil: "networkidle" }); // focus で、そのカードを前に（ほかのカードは aria-hidden）
    await page.keyboard.press("a"); // 人の操作（音の解放）。Shift などの修飾キーは操作に数えられない。画面の端を押すとリンクに当たる
    await sfx();
    const photo = await page.screenshot({ type: "jpeg", quality: 50 }); // 写真の代わり
    if (process.env.SOUND_DEBUG) {
      console.log("  debug:", await page.evaluate(() => `${location.href} h2: ${[...document.querySelectorAll("h2")].map((h) => h.textContent.trim()).join(" / ")}`));
      await page.screenshot({ path: ".shots/sound-check-solo.png" });
    }
    await page.locator("article", { hasText: "自分の家の雪かき" }).locator("button", { hasText: "雪かきGO！" }).click();
    await page.waitForTimeout(400);
    got = await sfx();
    ok(got.includes("confirm") && got.includes("missionStart@0.1"), `出撃！: ${got.join(" ")}`);
    await page.waitForTimeout(1600);
    c = await counts();
    ok(c.bgm === "mission", `ミッション中の BGM は「出撃！」（${c.bgm}）`);
    await page.evaluate(() => document.querySelectorAll("input[type=file]").forEach((i) => i.removeAttribute("capture"))); // headless ではカメラを開けないので、ふつうのファイル選択に
    for (const which of ["Before", "After"]) {
      if (process.env.SOUND_DEBUG) await page.screenshot({ path: `.shots/sound-check-${which}.png` });
      await page.getByRole("button", { name: new RegExp(`${which} の写真を`) }).click({ force: true }); // どちらの写真かを決める（ready-pulse で動き続けるので force）
      await page.locator("input[type=file]").first().setInputFiles({ name: `${which}.jpg`, mimeType: "image/jpeg", buffer: photo });
      await page.waitForTimeout(1500);
    }
    got = await sfx();
    ok(got.filter((x) => x === "shutter").length === 2, `写真2枚でカシャッ×2: ${got.filter((x) => x === "shutter").length}`);
    await page.getByRole("button", { name: /報告してクリア！/ }).click({ force: true });
    await page.waitForTimeout(800);
    got = await sfx();
    ok(got.includes("missionClear@0.1"), `クリア！: ${got.join(" ")}`);
    await page.waitForTimeout(2600);
    c = await counts();
    got = await sfx();
    ok(c.bgm === "clear", `完了画面の BGM は「灯りがともる」（${c.bgm}）`);
    ok(got.includes("lamp@0.2") && got.filter((x) => x.startsWith("countTick")).length >= 3 && got.includes("countPop"), `灯りと数え上げ: ${got.slice(0, 6).join(" ")} …`);
    const cardBtn = page.getByRole("button", { name: /カードを見る/ });
    if (await cardBtn.count()) {
      await cardBtn.click();
      await page.waitForTimeout(500);
      got = await sfx();
      const order = ["cardRise", "cardFlip@0.35", "cardSparkle@1.4", "cardStamp@1.9", "cardChime@2.3"];
      ok(order.every((n) => got.includes(n)), `カード演出（上がる→めくる→キラ〜ン→ドン→ピン）: ${got.join(" ")}`);
    } else ok(false, "カードのボタンが出なかった");
    await page.getByRole("button", { name: /地図へ戻る|戻る|閉じる/ }).first().click().catch(() => {});
    await page.waitForTimeout(800);
    c = await counts();
    ok(c.bgm === "morning", `完了画面を閉じると「しらかばの朝」（${c.bgm}）`);

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
