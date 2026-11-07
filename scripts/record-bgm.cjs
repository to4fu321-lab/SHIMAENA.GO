// 使い方: node scripts/record-bgm.cjs 出力.wav [曲]（曲: morning（既定。しらかばの朝＋今朝の雪の歌）／mission（出撃！ 1周））
// 本番ビルドを起動し、BGM（しらかばの朝 50 秒＋今朝の雪の歌 22 秒）を録音して WAV にする（耳で確かめる用）。山の値も出す。
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");
const PORT = 3126;
const OUT = process.argv[2];
const WHICH = process.argv[3] ?? "morning";
const PLAN = WHICH === "mission" ? [["/badge?as=h1", "mission", 34000]] : [["/map", "morning", 50000], ["/", "snow", 22000]];
(async () => {
  const server = spawn(path.join("node_modules", ".bin", "next"), ["start", "-p", String(PORT)], { stdio: "ignore", detached: true });
  try {
    const end = Date.now() + 40000;
    while (Date.now() < end) { try { const r = await fetch(`http://localhost:${PORT}/`); if (r.status < 500) break; } catch {} await new Promise(r => setTimeout(r, 500)); }
    const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.addInitScript(() => {
      window.__rec = { L: [], R: [], max: 0, on: false, sr: 0 };
      const Orig = window.AudioContext;
      window.AudioContext = class extends Orig {
        constructor(...a) {
          super(...a);
          window.__rec.sr = this.sampleRate;
          const sp = this.createScriptProcessor(4096, 2, 2);
          sp.onaudioprocess = (e) => {
            const l = e.inputBuffer.getChannelData(0), r = e.inputBuffer.getChannelData(1);
            if (window.__rec.on) { window.__rec.L.push(new Float32Array(l)); window.__rec.R.push(new Float32Array(r)); }
            for (let i = 0; i < l.length; i++) { const v = Math.max(Math.abs(l[i]), Math.abs(r[i])); if (v > window.__rec.max) window.__rec.max = v; }
            for (let c = 0; c < 2; c++) e.outputBuffer.getChannelData(c).set(e.inputBuffer.getChannelData(c));
          };
          sp.connect(super.destination);
          Object.defineProperty(this, "destination", { value: sp });
        }
      };
    });
    const parts = [];
    for (const [url, label, wait] of PLAN) {
      await page.goto(`http://localhost:${PORT}${url}`);
      await page.waitForTimeout(800);
      await page.keyboard.press("a"); // 人の操作（音の解放）。画面の端を押すとリンクに当たる
      await page.evaluate(() => { window.__rec.L = []; window.__rec.R = []; window.__rec.max = 0; window.__rec.on = true; });
      await page.waitForTimeout(wait);
      const r = await page.evaluate(() => {
        window.__rec.on = false;
        const join = (arr) => { const n = arr.reduce((s, a) => s + a.length, 0); const o = new Int16Array(n); let k = 0; for (const a of arr) for (let i = 0; i < a.length; i++) o[k++] = Math.max(-32768, Math.min(32767, Math.round(a[i] * 32767))); return o; };
        const L = join(window.__rec.L), R = join(window.__rec.R);
        const inter = new Int16Array(L.length * 2);
        for (let i = 0; i < L.length; i++) { inter[2 * i] = L[i]; inter[2 * i + 1] = R[i]; }
        let bin = ""; const u8 = new Uint8Array(inter.buffer);
        for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return { b64: btoa(bin), max: window.__rec.max, sr: window.__rec.sr, bgm: document.documentElement.dataset.bgm };
      });
      console.log(label, r.bgm, "peak", r.max.toFixed(3), "sr", r.sr);
      parts.push({ pcm: Buffer.from(r.b64, "base64"), sr: r.sr });
    }
    await browser.close();
    // 1本の WAV に（曲の間に 1 秒の無音）
    const sr = parts[0].sr;
    const gap = Buffer.alloc(sr * 4);
    const pcm = Buffer.concat(parts.flatMap((p, i) => (i ? [gap, p.pcm] : [p.pcm])));
    const h = Buffer.alloc(44);
    h.write("RIFF", 0); h.writeUInt32LE(36 + pcm.length, 4); h.write("WAVE", 8); h.write("fmt ", 12);
    h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
    h.write("data", 36); h.writeUInt32LE(pcm.length, 40);
    fs.writeFileSync(OUT, Buffer.concat([h, pcm]));
    console.log("wrote", OUT, (pcm.length / sr / 4).toFixed(1), "sec");
  } finally { try { process.kill(-server.pid); } catch {} }
})();
