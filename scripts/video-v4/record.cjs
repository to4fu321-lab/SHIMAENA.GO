// 紹介動画 v4「隊長の朝」の「動く画面」を、本番ビルドから録る。
// 使い方: 先に `npm run build`。それから `node scripts/video-v4/record.cjs`（約3分）。
//   出力: .video/v4/rec/<場面>/00001.jpg…（30fps・780×1688）と .video/v4/rec/scenes.json（長さ・押した瞬間と場所）
//   本番（公開中のアプリ）で録るとき: REC_BASE=https://shimaena-go.vercel.app ADMIN_PW=（/admin の合言葉）node scripts/video-v4/record.cjs
//     … 隊長の理由・写真の確認・カードの絵が、本物の Claude の答えになる。合言葉はファイルに書かない。終わったら見本の状態に戻す。
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
const PROD = process.env.REC_BASE || ""; // 本番で録るときの URL
const B = PROD || `http://localhost:${PORT}`;
const SLOW = PROD ? 1 : 0; // 本番は Claude を待つ
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
  if (PROD) { offsetMs = 0; fs.writeFileSync(SHIFT, "0"); } // 本番の時計はずらせない（いまの日付と時刻で録る）
  const server = PROD ? null : spawn(path.join(ROOT, "node_modules/.bin/next"), ["start", "-p", String(PORT)], {
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
    if (!PROD) await ctx.addInitScript(clockScript(offsetMs));
    return ctx;
  };
  try {
    await waitForServer();
    const opCtx = await newCtx();
    const op = await opCtx.newPage();
    const admin = async (label, tab) => {
      await op.goto(B + "/admin", { waitUntil: "networkidle" });
      const pw = op.locator('input[name="password"]');
      if (await pw.count()) { await pw.fill(process.env.ADMIN_PW || ""); await op.getByRole("button", { name: "開く" }).click(); await op.getByRole("button", { name: /前夜の予告/ }).waitFor({ timeout: 20000 }); }
      if (tab) { await op.getByRole("tab", { name: tab }).click(); await sleep(400); }
      const before = await op.locator("header").first().innerText().catch(() => "");
      // 本番は Claude の返事を待つ。サーバーの返事が返るまで次を押さない（重ねて押すと順番待ちになり、ほかの画面までエラーになる）
      const done = PROD ? op.waitForResponse((r) => r.request().method() === "POST" && /\/admin/.test(r.url()), { timeout: 330000 }).catch(() => null) : null;
      await op.getByRole("button", { name: label }).first().click();
      await sleep(2200);
      if (PROD) { await done; await op.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {}); await sleep(1500); }
      void before;
    };
    /** 架空の人として「行く（10分でも）」を押す（録らない） */
    const goAs = async (as, base) => {
      await op.goto(`${B}/chat?as=${as}`, { waitUntil: "networkidle" });
      await sleep(1200);
      const any = op.getByRole("button", { name: /行く（10分でも）/ });
      const btn = (await goButton(op, base)) || ((await any.count()) ? any.last() : null);
      if (btn) { await btn.click(); await sleep(PROD ? 5000 : 2500); console.log(`  ${as} も拠点${base}へ`); }
    };
    const goButton = async (page, base) => {
      const goBtns = page.getByRole("button", { name: /行く（10分でも）/ });
      const idx = await page.evaluate((base) => {
        const gos = [...document.querySelectorAll("button")].filter((b) => /行く（10分でも）/.test(b.textContent));
        const leaves = [...document.querySelectorAll("p, span, div")].filter((e) => e.children.length === 0 && /拠点\d+/.test(e.textContent));
        return gos.findIndex((b) => { const before = leaves.filter((l) => l.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING); return new RegExp(`拠点${base}[^0-9]`).test((before.at(-1)?.textContent ?? "") + " "); });
      }, base);
      if (idx >= 0) return goBtns.nth(idx);
      return base ? null : (await goBtns.count()) ? goBtns.last() : null;
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
      await tap("omakase", page.locator("button", { hasText: "家の人は雪かきできない" }).first()); await sleep(1500);
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
      const end = Date.now() + (PROD ? 150000 : 20000); const got = {};
      while (Date.now() < end && Object.keys(got).length < 3) {
        for (const k of Object.keys(pages)) if (!got[k] && (await count(pages[k])) !== before[k]) { got[k] = true; mark("arrive-" + k, { phone: k }); }
        await sleep(150);
      }
      await sleep(4500);
    }, { settle: 2000 });

    // ---- 2) 行く（田中さん）→ 家の人（小林さん）に「向かっています」と合言葉 ----
    if (!want("ring")) await admin("1 6:30"); // 場面を選んで撮り直すときも、朝の状態は作る
    await op.goto(`${B}/chat?as=h1`, { waitUntil: "networkidle" }); await sleep(1500);
    const myBase = await op.evaluate(() => {
      const gos = [...document.querySelectorAll("button")].filter((b) => /行く（10分でも）/.test(b.textContent));
      const go = gos.at(-1); if (!go) return 7;
      const leaves = [...document.querySelectorAll("p, span, div")].filter((e) => e.children.length === 0 && /拠点\d+/.test(e.textContent) && (e.compareDocumentPosition(go) & Node.DOCUMENT_POSITION_FOLLOWING));
      return +(leaves.at(-1)?.textContent.match(/拠点(\d+)/)?.[1] ?? 7);
    });
    console.log("  田中さんの行き先: 拠点" + myBase);
    scenes._base = { base: myBase };
    await record("go", [{ key: "a", url: "/chat?as=h1" }, { key: "c", url: `/chat?as=r${myBase}` }], async ({ pages, mark, tap }) => {
      await sleep(1200);
      const btn = (await goButton(pages.a, myBase)) || pages.a.getByRole("button", { name: /行く（10分でも）/ }).last();
      const countC = () => pages.c.evaluate(() => document.querySelectorAll("main *").length);
      const c0 = await countC();
      await tap("go", btn);
      await pages.a.getByText(/集合です/).first().waitFor({ timeout: 120000 }).catch(() => {});
      // 通信の失敗の表示が出たら、開き直す（行き先は保存されているので、返事だけが残る）
      if (await pages.a.getByText(/うまくいきませんでした/).count()) { console.log("  （トークを開き直す）"); await pages.a.reload({ waitUntil: "networkidle" }); await sleep(1500); await pages.a.evaluate(`(() => { const el = ${chatScroller}; if (el) el.scrollTop = el.scrollHeight; })()`); await sleep(800); }
      mark("reply", { phone: "a" });
      const end = Date.now() + (PROD ? 40000 : 12000);
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
      await sleep(1800);
      const box = await page.evaluate(() => { const el = [...document.querySelectorAll("span")].find((e) => e.textContent.trim() === "シマエナ隊長から"); const r = el?.parentElement?.getBoundingClientRect(); return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null; });
      mark("box", box ? { box } : {});
      await sleep(3200);
    }, { settle: 2500 });

    // ほかのチームの人も動く（録らない）
    // 同じ家（拠点7）に、ほかの人も来る（あとで「なかま帳」に残る）
    if (!want("go")) await goAs("h1", myBase).catch(() => {});
    for (const who of ["h11", "h2", "h3", "h5", "h6"]) await goAs(who, myBase).catch(() => {});

    // ---- 3) 町の地図: ほかの家が次々に終わって、チームの色に染まる ----
    addClock(6);
    await record("map", [{ key: "a", url: "/map?as=h1" }], async ({ page, mark }) => {
      // ほかの人の完了画面は「前に見た完了」とちがうと出る。前に見たものを毎回「なし」と答えると、覚えるだけで出ない（地図の色だけが変わる）
      await page.evaluate(() => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (k) { return k === "shimaena:lastClear" ? null : g.call(this, k); }; });
      await sleep(800);
      const fold = page.locator('[aria-label="シートを畳んで地図を大きくする"]');
      if (await fold.count()) { const b = await fold.boundingBox(); mark("fold", b ? { x: Math.round(b.x + b.width / 2), y: Math.round(b.y + 14), tap: true } : {}); await sleep(450); await fold.press("Enter"); await page.evaluate(() => document.activeElement?.blur?.()); }
      await sleep(1500);
      // 家の印が画面の外にあるときは、全部入るまで地図を引く（本番は家が10軒あり、広い）
      for (let z = 0; z < 3; z++) {
        const out = await page.evaluate(() => [...document.querySelectorAll(".leaflet-marker-icon")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && (r.left < 4 || r.right > innerWidth - 4 || r.top < 150 || r.bottom > 700); }).length);
        const all = await page.evaluate(() => document.querySelectorAll(".leaflet-marker-icon").length);
        if (out * 2 < all) break; // 少しだけ外にあるなら、引かない（引くと印が重なって見えなくなる）
        await page.locator(".leaflet-control-zoom-out").click({ force: true }); await sleep(1100);
        console.log("  地図を引く（外の印", out, "）");
      }
      // 上に浮いている「道の危険を知らせる」ボタンが家の印にかぶるときは、指で地図を下へずらす（印を全部見せるため）
      const shift = await page.evaluate(() => {
        const btn = [...document.querySelectorAll("button, a")].find((e) => /道の危険を知らせる/.test(e.textContent || "") && e.getBoundingClientRect().top < 300);
        if (!btn) return 0;
        const bottom = btn.getBoundingClientRect().bottom;
        let top = 1e9;
        for (const e of document.querySelectorAll(".leaflet-marker-icon, .leaflet-overlay-pane path")) { const r = e.getBoundingClientRect(); if (r.width < 4 || r.width > 200 || r.top < 60) continue; top = Math.min(top, r.top); }
        return top < 1e9 ? Math.max(0, Math.round(bottom + 14 - top)) : 0;
      });
      if (shift > 0) {
        await page.mouse.move(40, 560); await page.mouse.down();
        for (let i = 1; i <= 12; i++) { await page.mouse.move(40, 560 + (shift * i) / 12); await sleep(30); }
        await sleep(250); await page.mouse.up(); await sleep(900);
        console.log("  地図を下へ", shift, "px");
      }
      // 家の印（番号の丸と四角）がある範囲を記録する（合成で、そこを大きく映す）
      const bbox = await page.evaluate(() => {
        const els = [...document.querySelectorAll(".leaflet-marker-icon, .leaflet-overlay-pane path")];
        let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
        for (const e of els) { const r = e.getBoundingClientRect(); if (r.width < 4 || r.width > 200 || r.top < 60 || r.bottom > 760) continue; x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom); }
        return x1 > x0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0, n: els.length } : null;
      });
      mark("bbox", bbox ? { box: bbox } : {});
      for (let i = 1; i <= (PROD ? 4 : 6); i++) {
        // ほかの人の完了の画面は「前に見た完了」とちがうと出る。覚えを消しておくと、覚えるだけで出ない（地図の色だけが変わる）
        await page.evaluate(() => sessionStorage.removeItem("shimaena:lastClear"));
        const before = await page.evaluate(() => document.querySelector("main")?.innerText ?? document.body.innerText);
        await admin("4 1軒、完了にする");
        for (let k = 0; k < (PROD ? 600 : 40); k++) { if ((await page.evaluate(() => document.querySelector("main")?.innerText ?? document.body.innerText)) !== before) break; await sleep(150); }
        mark("done" + i);
        await sleep(900);
      }
      await sleep(2500);
    }, { settle: 2500 });

    // ---- 4) 終わりました → 写真1枚 → 完了 → カード ----
    addClock(8);
    await record("finish", [{ key: "a", url: "/map?as=h1" }], async ({ page, mark, tap }) => {
      await sleep(1200);
      const finBtn = page.getByRole("button", { name: "終わりました" });
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), tap("finish", finBtn)]);
      await sleep(900); // カメラが開いて撮るまでの間（合成で写真を見せる）
      mark("photo");
      // 同じ写真は断られるので、毎回1点だけ変える
      const photo = path.join(V, "photo.jpg");
      require("child_process").execFileSync("ffmpeg", ["-y", "-v", "error", "-i", path.join(ROOT, "public/demo/entrance.jpg"), "-vf", `drawbox=x=${Math.floor(Math.random() * 1300)}:y=${Math.floor(Math.random() * 700)}:w=2:h=2:color=0x${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}:t=fill`, "-q:v", "2", photo]);
      await chooser.setFiles(photo);
      const clearH = page.getByRole("heading", { name: /あなたの10分で/ });
      const anyway = page.getByRole("button", { name: /それでも完了にする/ });
      for (let i = 0; i < 1600; i++) { if (await clearH.count()) break; if (await anyway.count()) { console.log("  （写真の確認で「まだ」→ それでも完了にする）"); await anyway.first().click(); } await sleep(150); }
      mark("clear");
      await sleep(5200);
      const card = page.getByRole("button", { name: /カードを見る/ });
      if (!(await card.count())) { console.log("  （完了画面にカードがありません）"); await sleep(3000); return; }
      await tap("card", card);
      await page.getByText(/カードを発行しました/).first().waitFor({ timeout: 120000 }).catch(() => {});
      mark("cardshown");
      await sleep(6500);
    }, { settle: 2000 });

    // ---- 4b) 次の人へバトン（途中まででも渡せる）→ 近所の人の画面に届く ----
    await record("baton", [{ key: "a", url: "/connect?as=h1" }], async ({ page, tap, mark }) => {
      await sleep(1000);
      await tap("tab", page.getByRole("tab", { name: "バトン" }).first()); await sleep(1300);
      const give = page.getByRole("button", { name: /次の人へバトンを渡す/ });
      if (await give.count()) { await tap("give", give.first()); await sleep(1300); }
      await tap("msg", page.getByRole("button", { name: "続きをお願いします" }).first()); await sleep(900);
      await tap("half", page.getByRole("button", { name: "途中まで" }).first()); await sleep(900);
      await tap("pass", page.getByRole("button", { name: /^渡す$/ }).first());
      await sleep(3500);
      mark("passed");
      await sleep(1500);
    }, { settle: 2200 }).catch((e) => console.log("baton は撮れませんでした:", e.message));
    await record("batonget", [{ key: "b", url: "/connect?as=h11" }], async ({ page, tap }) => {
      await sleep(900);
      await tap("tab", page.getByRole("tab", { name: "バトン" }).first());
      await sleep(4500);
    }, { settle: 2200 }).catch((e) => console.log("batonget は撮れませんでした:", e.message));

    // ---- 4c) なかま帳: 一緒に雪かきをした人が残る →「また一緒に」----
    await record("nakama", [{ key: "a", url: "/me?as=h1" }], async ({ page, tap }) => {
      await sleep(1000);
      await tap("tab", page.getByRole("tab", { name: /なかま帳/ }).first()); await sleep(2600);
      const again = page.getByRole("button", { name: /また一緒に/ });
      if (await again.count()) { await tap("again", again.first()); await sleep(2500); }
      const next = page.getByRole("button", { name: "›" });
      if (await next.count()) { await tap("next", next.first()).catch(() => {}); await sleep(2200); }
      await sleep(800);
    }, { settle: 2200 }).catch((e) => console.log("nakama は撮れませんでした:", e.message));

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

    // 本番で録ったあとは、見本の状態に戻しておく（審査や見学の人が、いつもの朝から始められるように）
    if (PROD) { await admin(/見本の状態に戻す/, "ほか").then(() => console.log("本番を見本の状態に戻しました")).catch((e) => console.log("見本の状態に戻せませんでした:", e.message)); }

    // どこで録ったか（本番なら、画面の中の Claude の答えは本物）
    scenes._meta = { prod: !!PROD, date: new Date().toISOString().slice(0, 10) };
    fs.writeFileSync(path.join(OUT, "scenes.json"), JSON.stringify(scenes, null, 1));
    console.log("できた:", path.join(OUT, "scenes.json"));
  } finally {
    await browser.close();
    try { if (server) process.kill(-server.pid, "SIGTERM"); } catch {}
  }
})().catch((e) => { console.error(e); process.exit(1); });
