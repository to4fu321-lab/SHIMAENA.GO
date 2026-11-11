// 紹介動画 v4「隊長の朝」の「動く画面」を、本番ビルドから録る。
// 使い方: 先に `npm run build`。それから `node scripts/video-v4/record.cjs`（約3分）。
//   出力: .video/v4/rec/<場面>/00001.jpg…（30fps・780×1688）と .video/v4/rec/scenes.json（長さ・押した瞬間と場所）
// しくみ:
//   - サーバーは自分で起動する（PORT 3141）。時計は timeshift.cjs で「12月14日（月）の朝 6:29」から始める（いつ撮っても同じ絵になる）。
//   - 画面は CDP の screencast を 2倍の解像度でコマ撮り（cast.cjs）。押した場所は marks に残し、合成で指の印を出す。
//   - 鍵（ANTHROPIC_API_KEY）がなければ隊長の文・写真の確認・カードは見本の答え。.env.local に鍵があれば本物の Claude の答えで録れる。
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { startCast, toCfr } = require("../video-v3/cast.cjs");

const ROOT = path.resolve(__dirname, "../..");
const V = path.join(ROOT, ".video/v4");
const OUT = path.join(V, "rec");
const PORT = 3141;
const B = `http://localhost:${PORT}`;
const SHIFT = path.join(V, "timeshift.txt");
const ONLY = process.argv[2] ? process.argv[2].split(",") : null; // 例: node record.cjs home,ask（状態に頼らない場面だけ撮り直す）
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** 時計を「日本時間のこの時刻」に合わせる（サーバーとブラウザの両方） */
let offsetMs = 0;
const setClock = (jst) => {
  offsetMs = new Date(jst + "+09:00").getTime() - Date.now();
  fs.writeFileSync(SHIFT, String(offsetMs));
};
const addClock = (minutes) => { offsetMs += minutes * 60000; fs.writeFileSync(SHIFT, String(offsetMs)); };

async function waitForServer() {
  const end = Date.now() + 60000;
  while (Date.now() < end) {
    try { const r = await fetch(B + "/"); if (r.status < 500) return; } catch {}
    await sleep(500);
  }
  throw new Error("サーバーが起動しませんでした");
}

const scenes = fs.existsSync(path.join(OUT, "scenes.json")) && ONLY ? JSON.parse(fs.readFileSync(path.join(OUT, "scenes.json"), "utf8")) : {};
const want = (name) => !ONLY || ONLY.includes(name);

(async () => {
  setClock("2026-12-14T06:27:00");
  const server = spawn(path.join(ROOT, "node_modules/.bin/next"), ["start", "-p", String(PORT)], {
    stdio: "ignore", detached: true, cwd: ROOT,
    env: { ...process.env, NODE_OPTIONS: `--require ${path.join(__dirname, "../video-v3/timeshift.cjs")}`, TIMESHIFT_FILE: SHIFT },
  });
  const browser = await chromium.launch({
    args: ["--force-device-scale-factor=2", "--window-size=390,844", "--hide-scrollbars", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--autoplay-policy=no-user-gesture-required"],
  });
  // ブラウザの時計もずらす（ホームの空や「◯分前」がサーバーと合うように）
  const clockScript = (off) => `(() => { const R = Date; const off = ${off}; window.Date = new Proxy(R, { construct(t, a) { return a.length ? new t(...a) : new t(t.now() + off); }, apply() { return new R(R.now() + off).toString(); }, get(t, p) { return p === "now" ? () => t.now() + off : Reflect.get(t, p); } }); })();`;
  const newCtx = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: null, permissions: ["microphone", "geolocation"], geolocation: { latitude: 43.04085, longitude: 141.37135, accuracy: 8 }, locale: "ja-JP", timezoneId: "Asia/Tokyo", ...opts });
    await ctx.addInitScript(clockScript(offsetMs));
    return ctx;
  };
  try {
    await waitForServer();
    const opCtx = await newCtx();
    const op = await opCtx.newPage();
    const admin = async (label, tab) => {
      await op.goto(B + "/admin", { waitUntil: "networkidle" });
      if (tab) { await op.getByRole("tab", { name: tab }).click(); await sleep(400); }
      await op.getByRole("button", { name: label }).first().click();
      await sleep(2200);
    };
    /** 架空の人として「行く（10分でも）」を押す（録らない） */
    const goAs = async (as, base) => {
      await op.goto(`${B}/chat?as=${as}`, { waitUntil: "networkidle" });
      await sleep(1200);
      const btn = await goButton(op, base);
      if (btn) { await btn.click(); await sleep(2500); }
    };
    const goButton = async (page, base) => {
      const goBtns = page.getByRole("button", { name: /行く（10分でも）/ });
      const n = await goBtns.count();
      for (let i = n - 1; i >= 0; i--) {
        const b = goBtns.nth(i);
        const near = await b.evaluate((el) => el.closest("div")?.parentElement?.innerText || "");
        if (new RegExp(`拠点${base}[^0-9]`).test(near + " ")) return b;
      }
      return n ? goBtns.last() : null;
    };

    /**
     * 録画つきの場面。phones = [{ key, url }]（1台なら1つ）。fn({ pages, mark, tap, cast }) の中で操作する。
     * marks: { 名前: { t, x?, y?, phone? } }（t は場面の頭からの秒。x,y はスマホの画面の座標 390×844）
     */
    const record = async (name, phones, fn, { settle = 1500 } = {}) => {
      if (!want(name)) return;
      const ctxs = [], pages = {}, casts = {};
      for (const ph of phones) {
        const ctx = await newCtx(ph.ctx);
        const page = await ctx.newPage();
        await page.goto(B + ph.url, { waitUntil: "networkidle" });
        ctxs.push(ctx); pages[ph.key] = page;
      }
      await sleep(settle);
      const t0 = Date.now() / 1000;
      for (const ph of phones) casts[ph.key] = await startCast(pages[ph.key], path.join(OUT, phones.length > 1 ? `${name}-${ph.key}` : name), t0);
      const marks = {};
      const now = () => +(Date.now() / 1000 - t0).toFixed(2);
      const mark = (k, extra) => { marks[k] = { t: now(), ...(extra || {}) }; console.log(`  ${name}: ${k} @ ${marks[k].t}s`); };
      /** 押す: 場所を記録 → 0.45 秒待つ（合成で指が先に着く）→ 押す */
      const tap = async (k, locator, { phone = phones[0].key, click = true, scroll = true } = {}) => {
        // 脈打つボタン（ready-pulse）は「止まるまで待つ」と進まないので、待たずに見える所へ出して押す
        if (scroll) await locator.evaluate((el) => el.scrollIntoView({ block: "nearest" })).catch(() => {});
        await sleep(250);
        const b = await locator.boundingBox();
        mark(k, b ? { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + b.height / 2), phone, tap: true } : { phone });
        marks[k].t = +(marks[k].t + 0.45).toFixed(2); // 押した瞬間
        await sleep(450);
        if (click) await locator.click({ force: true });
      };
      await fn({ pages, page: pages[phones[0].key], mark, tap, now });
      const seconds = now();
      const out = { seconds, marks, phones: {} };
      for (const ph of phones) {
        const r = await casts[ph.key].stop();
        const dir = phones.length > 1 ? `${name}-${ph.key}` : name;
        const n = toCfr(path.join(OUT, dir), r.frames, seconds);
        out.phones[ph.key] = { dir, frames: n };
      }
      for (const c of ctxs) await c.close();
      scenes[name] = out;
      fs.writeFileSync(path.join(OUT, "scenes.json"), JSON.stringify(scenes, null, 1));
      console.log(`録画: ${name} ${seconds}s`);
    };
    /** トークをいちばん下へ（すぐ）／なめらかに送る */
    const chatScroller = `(() => [...document.querySelectorAll("*")].find((e) => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)))()`;
    const smoothScroll = (page, find, to, ms) => page.evaluate(([find, to, ms]) => new Promise((done) => {
      const el = eval(find); if (!el) return done();
      const from = el.scrollTop, target = to === "end" ? el.scrollHeight - el.clientHeight : to === "top" ? 0 : to, start = performance.now();
      const step = (t) => { const k = Math.min(1, (t - start) / ms); el.scrollTop = from + (target - from) * (1 - Math.cos(k * Math.PI)) / 2; if (k < 1) requestAnimationFrame(step); else done(); };
      requestAnimationFrame(step);
    }), [find, to, ms]);

    // ---- 0) 朝をまっさらに ----
    await admin("0 前夜の予告");

    // お願いする家（小林さん・拠点7）の登録画面: おまかせ → 玄関前
    await record("ask", [{ key: "c", url: "/ask?as=r7" }], async ({ page, tap }) => {
      await sleep(1600);
      await tap("omakase", page.getByRole("button", { name: /おまかせ/ }).first()); await sleep(1500);
      await tap("genkan", page.locator("button", { hasText: "玄関前" }).first()); await sleep(2600);
    });

    // ---- 1) 6:30 積もった: 3台のスマホに同時に届く ----
    setClock("2026-12-14T06:29:52");
    await record("ring", [{ key: "a", url: "/chat?as=h1" }, { key: "b", url: "/chat?as=h11" }, { key: "c", url: "/chat?as=r7" }], async ({ pages, mark }) => {
      await sleep(1200);
      const count = (p) => p.evaluate(() => document.querySelectorAll("main *").length);
      const before = {}; for (const k of Object.keys(pages)) before[k] = await count(pages[k]);
      mark("ring");
      await admin("1 6:30");
      const end = Date.now() + 20000; const got = {};
      while (Date.now() < end && Object.keys(got).length < 3) {
        for (const k of Object.keys(pages)) if (!got[k] && (await count(pages[k])) !== before[k]) { got[k] = true; mark("arrive-" + k, { phone: k }); }
        await sleep(150);
      }
      await sleep(4500);
    }, { settle: 2000 });

    // ホーム（田中さん）: 隊長の吹き出し → 「雪かきGO！」で地図へ
    await record("home", [{ key: "a", url: "/?as=h1" }], async ({ page, tap }) => {
      await sleep(4200);
      const go = page.getByRole("link", { name: /雪かきGO/ }).or(page.getByRole("button", { name: /雪かきGO/ })).first();
      if (await go.count()) { await tap("gogo", go); await sleep(3200); }
    }, { settle: 2500 }).catch((e) => console.log("home は撮れませんでした:", e.message));

    // ---- 2) 行く（田中さん）→ 家の人（小林さん）に「向かっています」と合言葉 ----
    await record("go", [{ key: "a", url: "/chat?as=h1" }, { key: "c", url: "/chat?as=r7" }], async ({ pages, mark, tap }) => {
      await sleep(1200);
      const btn = await goButton(pages.a, 7);
      const countC = () => pages.c.evaluate(() => document.querySelectorAll("main *").length);
      const c0 = await countC();
      await tap("go", btn);
      await pages.a.getByText(/集合です/).first().waitFor({ timeout: 20000 }).catch(() => {});
      mark("reply", { phone: "a" });
      const end = Date.now() + 12000;
      while (Date.now() < end && (await countC()) === c0) await sleep(150);
      mark("coming", { phone: "c" });
      await sleep(4500);
    }, { settle: 2000 });

    // 地図の下の「シマエナ隊長から」（Claude が決めた人数と理由）
    await record("reason", [{ key: "a", url: "/map?as=h1" }], async ({ page, mark }) => {
      await sleep(1600);
      mark("scroll");
      await page.evaluate(() => {
        const el = [...document.querySelectorAll("span")].find((e) => e.textContent.trim() === "シマエナ隊長から");
        el?.parentElement?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      await sleep(5000);
    }, { settle: 2500 });

    // ほかのチームの人も動く（録らない）
    await goAs("h11", 7);
    for (const who of ["h2", "h5", "h8", "h12"]) await goAs(who, 0).catch(() => {});

    // ---- 3) 町の地図: ほかの家が次々に終わって、チームの色に染まる ----
    addClock(6);
    await record("map", [{ key: "a", url: "/map?as=h1" }], async ({ page, mark }) => {
      await sleep(800);
      const fold = page.locator('[aria-label="シートを畳んで地図を大きくする"]');
      if (await fold.count()) { const b = await fold.boundingBox(); mark("fold", b ? { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + 14), tap: true } : {}); await sleep(450); await fold.press("Enter"); await page.evaluate(() => document.activeElement?.blur?.()); }
      await sleep(1500);
      for (let i = 1; i <= 6; i++) {
        // ほかの人の完了の画面は「前に見た完了」とちがうと出る。覚えを消しておくと、覚えるだけで出ない（地図の色だけが変わる）
        await page.evaluate(() => sessionStorage.removeItem("shimaena:lastClear"));
        const before = await page.evaluate(() => document.querySelector("main")?.innerText ?? document.body.innerText);
        await admin("4 1軒、完了にする");
        for (let k = 0; k < 40; k++) { if ((await page.evaluate(() => document.querySelector("main")?.innerText ?? document.body.innerText)) !== before) break; await sleep(150); }
        mark("done" + i);
        await sleep(900);
      }
      await sleep(2500);
    }, { settle: 2500 });

    // 同じ家（拠点7）に、同じチームの人も加わる（録らない。なかま帳に仲間が載るように）
    for (const who of ["h13", "h16", "h19"]) await goAs(who, 7).catch(() => {});

    // ---- 4) 終わりました → 写真1枚 → 完了 → カード ----
    addClock(8);
    await record("finish", [{ key: "a", url: "/map?as=h1" }], async ({ page, mark, tap }) => {
      await sleep(1200);
      const finBtn = page.getByRole("button", { name: "終わりました" });
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), tap("finish", finBtn)]);
      await sleep(900); // カメラが開いて撮るまでの間（合成で写真を見せる）
      mark("photo");
      await chooser.setFiles(path.join(ROOT, "public/demo/entrance.jpg"));
      await page.getByRole("heading", { name: /あなたの10分で/ }).waitFor({ timeout: 60000 });
      mark("clear");
      await sleep(5200);
      const card = page.getByRole("button", { name: /カードを見る/ });
      await tap("card", card);
      await sleep(6500);
    }, { settle: 2000 });

    // ---- 5) 家の人: 🎤 声でありがとう ----
    addClock(18);
    await record("thanks", [{ key: "c", url: "/chat?as=r7" }], async ({ page, mark, tap }) => {
      await sleep(1500);
      await tap("mic", page.getByRole("link", { name: /声でありがとう/ }).first());
      await page.waitForURL(/thanks/); await page.waitForLoadState("networkidle");
      await sleep(1600);
      await tap("talk", page.getByRole("button", { name: /押して話す/ }));
      await sleep(7600); // 声（約7秒）
      await tap("stop", page.getByRole("button", { name: /とめる/ }));
      await sleep(1500);
      await tap("send", page.getByRole("button", { name: /届ける/ }));
      await sleep(3200);
    }, { settle: 2200 });

    // 手伝った人: 声が届く → 聞く
    await record("listen", [{ key: "a", url: "/chat?as=h1" }], async ({ page, mark, tap }) => {
      await sleep(1800);
      await tap("listen", page.getByRole("link", { name: /声を聞く/ }).last());
      await page.waitForURL(/thanks/); await page.waitForLoadState("networkidle");
      await sleep(1200);
      mark("play");
      await page.locator("audio").evaluate((a) => a.play().catch(() => {}));
      await sleep(9000);
    }, { settle: 2500 });

    // ---- 6) そのほかの入口 ----
    // 道の危険を知らせる（つるつる）: 雪かきができない人も手伝える
    await record("road", [{ key: "a", url: "/map?view=road&as=h1" }], async ({ page, mark, tap }) => {
      await sleep(1200);
      await tap("open", page.getByRole("button", { name: /道の危険を知らせる/ }).first());
      await sleep(1300);
      const tile = page.locator('[role="radio"][aria-label="凍って転びやすい"]');
      await tap("tile", tile); await sleep(1100);
      await tap("cam", page.locator('button[aria-label="写真を撮る"]'), { click: false, scroll: false });
      await sleep(700);
      mark("photo");
      await page.locator('input[type="file"][capture]').setInputFiles(path.join(ROOT, "docs/video/ref-street.jpg"));
      const send = page.getByRole("button", { name: /^報告する$/ });
      await send.waitFor({ timeout: 30000 });
      for (let i = 0; i < 100 && (await send.isDisabled()); i++) await sleep(200);
      mark("blurred");
      await sleep(1400);
      await tap("send", send);
      await page.getByText(/報告しました|を出しました/).first().waitFor({ timeout: 60000 }).catch(() => {});
      mark("sent");
      await sleep(4500);
    }, { settle: 2500 }).catch((e) => console.log("road は撮れませんでした:", e.message));

    // 高齢者が教える側・語る側に: 雪の聞き書き → 町の週刊絵本
    await admin("デモの聞き書きを1件入れる", "ほか").catch(() => {});
    await admin("今週の絵本を作る", "ほか").catch(() => {});
    await record("book", [{ key: "a", url: "/book?as=h1" }], async ({ page, tap }) => {
      await sleep(2200);
      const next = page.getByRole("button", { name: /›|次/ });
      for (let i = 0; i < 3; i++) if (await next.count()) { await tap("next" + i, next.first()).catch(() => {}); await sleep(1900); }
      await sleep(800);
    });

    // ---- 7) ほかの入口: なかま帳・バトン・ソロ活動（v4）----
    const tryTap = async (tap, k, loc, wait = 1500) => { try { if (await loc.count()) { await tap(k, loc.first()); await sleep(wait); return true; } } catch (e) { console.log("  押せませんでした:", k, e.message.split("\n")[0]); } return false; };
    await record("nakama", [{ key: "a", url: "/nakama?as=h1" }], async ({ page, tap }) => {
      await sleep(2200);
      await tryTap(tap, "with", page.getByRole("button", { name: /誰かと一緒に/ }).or(page.getByRole("radio", { name: /誰かと一緒に/ })), 3200);
      await sleep(600);
    }, { settle: 2500 }).catch((e) => console.log("nakama は撮れませんでした:", e.message));
    await record("baton", [{ key: "a", url: "/connect?as=h1" }], async ({ page, tap }) => {
      await sleep(1200);
      await tryTap(tap, "tab", page.getByRole("tab", { name: /バトン/ }), 1700);
      await tryTap(tap, "write", page.getByRole("button", { name: /バトンを渡す/ }), 1700);
      await tryTap(tap, "phrase", page.getByRole("button", { name: /続きをお願いします/ }).or(page.getByRole("radio", { name: /続きをお願いします/ })), 2200);
      await sleep(600);
    }, { settle: 2500 }).catch((e) => console.log("baton は撮れませんでした:", e.message));
    await record("solo", [{ key: "a", url: "/solo?as=h1" }], async ({ page, tap }) => {
      await sleep(2200);
      await tryTap(tap, "go", page.getByRole("button", { name: /雪かきGO/ }), 5200);
      await sleep(600);
    }, { settle: 2500 }).catch((e) => console.log("solo は撮れませんでした:", e.message));

    console.log("できた:", path.join(OUT, "scenes.json"));
  } finally {
    await browser.close();
    try { process.kill(-server.pid, "SIGTERM"); } catch {}
  }
})().catch((e) => { console.error(e); process.exit(1); });
