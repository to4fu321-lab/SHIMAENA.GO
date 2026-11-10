// 動画の音楽と効果音を作る（アプリと同じ Web Audio の楽器。音ファイルは使わない）。
// 使い方: node scripts/video-v3/score.cjs   → .video/v3/audio/music.wav と sfx.wav、cues.json（どの秒に何を鳴らしたか）
// 曲の並び（時間割の場面に合わせて、毎回計算し直す）:
//   課題: 風とエレピの静かな前奏（D。しらかばの朝と同じ調で、Bm から始まる）→ 一行の場面は風だけ
//   題字: 鈴が上がる → デモの前半は「しらかばの朝」（アプリの朝の曲）
//   「行く」を押した瞬間から「出撃！」（アプリでも出動の曲）→ 完了の瞬間に「灯りがともる」（アプリでも完了の曲）
//   声のありがとう: 音楽を止める（声だけ）→ 「AI は段取りを。人は、会いに行く。」で C の和音をひとつ
//   Claude の章: 「出撃！」の刻み（前半はメロディなし）→ 数字の場面でサビ
//   これから: 「灯りがともる」の広がる所 → 初雪は静かに → 最後の題字で和音がほどける
const { chromium } = require("playwright");
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const V = path.join(ROOT, ".video/v3");
const TL = JSON.parse(fs.readFileSync(path.join(V, "timeline.json"), "utf8"));
const EDIT = require("./edit.js")(TL);
const T = (id) => EDIT.scene[id].start, E = (id) => EDIT.scene[id].end, L = (id) => EDIT.line[id];
const BAR = { morning: (60 / 82) * 4, mission: (60 / 120) * 4, clear: (60 / 100) * 4, prelude: (60 / 66) * 4 };
const cue = EDIT.cue;

const music = [];
// ── 課題 ──
const preN = Math.max(4, Math.floor((T("key") + 0.4 - 0.7) / BAR.prelude));
music.push({ kind: "prelude", at: 0.7, n: preN, gain: 1.15, fadeIn: 1.2, fadeOut: 2.2 });
music.push({ kind: "swell", at: T("key") - 0.4, dur: E("key") - T("key") + 0.8, gain: 1.1, fadeIn: 1.0, fadeOut: 0.8 });
// ── 題字 → デモ前半（しらかばの朝）──
music.push({ kind: "fanfare", at: T("title") + 0.45, gain: 1.1 });
const mEnd = cue.goTap - 0.12;
const mN = Math.max(2, Math.min(8, Math.floor((mEnd - (T("title") + 1.5)) / BAR.morning)));
const mAt = mEnd - mN * BAR.morning;
music.push({ kind: "song", song: "morning", at: mAt, bars: Array.from({ length: mN }, (_, i) => i), gain: 1.0, fadeIn: 0.6 });
// ── 行く！（出撃！）→ 完了（灯りがともる）──
music.push({ kind: "riser", at: cue.goTap - 1.55, dur: 1.5, gain: 0.9 });
const gN = Math.ceil((cue.clear - cue.goTap) / BAR.mission) + 1;
music.push({ kind: "song", song: "mission", at: cue.goTap, bars: Array.from({ length: gN }, (_, i) => i % 8), gain: 0.92, until: cue.clear + 0.05, untilFade: 0.3 });
const cUntil = L("n27").end + 0.1;
const cN = Math.ceil((cUntil - cue.clear - 1.2) / BAR.clear) + 1;
music.push({ kind: "song", song: "clear", intro: true, at: cue.clear + 0.05, bars: Array.from({ length: cN }, (_, i) => i % 8), gain: 1.0, until: cUntil, untilFade: Math.min(3.4, cUntil - L("n26").at) });
// ── 声のあと: C の和音をひとつ → ほかの入口（静かなアルペジオ）──
music.push({ kind: "warm", at: T("principle") + 0.35, dur: E("principle") - T("principle") + 1.2, gain: 1.15 });
const moreN = Math.max(2, Math.round((E("more") - T("more") - 1.4) / BAR.clear));
music.push({ kind: "song", song: "clear", at: T("more") + 0.15, bars: Array.from({ length: moreN }, (_, i) => 8 + (i % 4)), gain: 0.95, fadeIn: 0.5, until: T("maker") - 0.05, untilFade: 0.6 });
// ── Claude の章（出撃！の刻み）→ 数字でサビ ──
music.push({ kind: "riser", at: T("maker") - 1.5, dur: 1.5, gain: 0.8 });
const clN = Math.floor((T("depth") - T("maker")) / BAR.mission);
const pat = [0, 1, 2, 3, 0, 1, 2, 3, 4, 5, 6, 7];
const clAt = T("depth") - clN * BAR.mission; // 数字の場面の頭に、サビの頭を合わせる
music.push({ kind: "song", song: "mission", at: clAt, bars: Array.from({ length: clN }, (_, i) => (i >= clN - 4 ? 4 + (i - (clN - 4)) : pat[i % 8])), gain: 0.8, fadeIn: 0.4 });
const chN = Math.ceil((T("future") - T("depth")) / BAR.mission);
music.push({ kind: "song", song: "mission", at: T("depth"), bars: Array.from({ length: chN }, (_, i) => 8 + (i % 8)), gain: 0.9, until: T("future") + 0.1, untilFade: 1.0 });
// ── これから（灯りがともる・広がる所）→ 初雪（静かに）→ 題字（おわりの和音）──
const fAt = T("future") + 0.15, endAt = L("n47").at - 0.15;
const wideN = Math.max(2, Math.min(4, Math.round((T("firstsnow") + 1.2 - fAt) / BAR.clear)));
music.push({ kind: "song", song: "clear", at: fAt, bars: Array.from({ length: wideN }, (_, i) => 12 + i), gain: 1.05, fadeIn: 0.5 });
const qAt = fAt + wideN * BAR.clear;
if (endAt - qAt > 1.2) music.push({ kind: "song", song: "clear", at: qAt, bars: Array.from({ length: Math.ceil((endAt - qAt) / BAR.clear) }, (_, i) => 8 + (i % 4)), gain: 1.0, until: endAt, untilFade: 0.7 });
music.push({ kind: "ending", at: endAt, dur: Math.max(5, TL.seconds - endAt - 0.1), gain: 1.2 });

const plan = { seconds: TL.seconds + 0.5, sampleRate: 48000, music, sfx: EDIT.sfx };

(async () => {
  fs.mkdirSync(path.join(V, "audio"), { recursive: true });
  const bundle = path.join(V, "audio/bundle.js");
  await esbuild.build({ entryPoints: [path.join(__dirname, "audio/entry.ts")], bundle: true, format: "iife", outfile: bundle, platform: "browser", target: "es2022", logLevel: "warning" });
  const b = await chromium.launch();
  const sr = plan.sampleRate, N = Math.ceil(plan.seconds * sr);
  const mix = [new Float32Array(N), new Float32Array(N)];
  // 曲ごとに別のページで書き出して（4つ並行）、時間の位置に重ねる
  const jobs = music.map((c, i) => ({ c, i }));
  let peakSum = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    const p = await b.newPage();
    p.on("pageerror", (e) => console.error("page error:", e.message));
    await p.setContent("<html><body></body></html>");
    await p.addScriptTag({ path: bundle });
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      const r = await p.evaluate(([c, sr, i]) => window.renderCue(c, sr, i), [job.c, sr, job.i]);
      const pcm = Buffer.from(r.b64, "base64"), n = pcm.length / 4, off = Math.round(r.offset * sr);
      for (let k = 0; k < n; k++) { const t = off + k; if (t < 0 || t >= N) continue; mix[0][t] += pcm.readInt16LE(k * 4) / 32768; mix[1][t] += pcm.readInt16LE(k * 4 + 2) / 32768; }
      peakSum = Math.max(peakSum, r.peak);
    }
    await p.close();
  }));
  const sp = await b.newPage();
  await sp.setContent("<html><body></body></html>");
  await sp.addScriptTag({ path: bundle });
  const sfx = await sp.evaluate((plan) => window.renderSfx(plan), plan);
  await b.close();
  const head = (len) => { const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + len, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(len, 40); return h; };
  let peak = 0;
  for (let k = 0; k < N; k++) peak = Math.max(peak, Math.abs(mix[0][k]), Math.abs(mix[1][k]));
  const norm = peak > 0.97 ? 0.97 / peak : 1;
  const out = Buffer.alloc(N * 4);
  for (let k = 0; k < N; k++) { out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[0][k] * norm)) * 32767), k * 4); out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[1][k] * norm)) * 32767), k * 4 + 2); }
  fs.writeFileSync(path.join(V, "audio/music.wav"), Buffer.concat([head(out.length), out]));
  const sfxPcm = Buffer.from(sfx.b64, "base64");
  fs.writeFileSync(path.join(V, "audio/sfx.wav"), Buffer.concat([head(sfxPcm.length), sfxPcm]));
  fs.writeFileSync(path.join(V, "audio/cues.json"), JSON.stringify(plan, null, 1));
  const mmss = (x) => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, "0")}`;
  for (const c of music) console.log(mmss(c.at).padEnd(7), c.kind === "song" ? `${c.song} [${c.bars.join(",")}]` : c.kind, c.until ? `→ ${mmss(c.until)}` : "");
  console.log(`音楽の山 ${peak.toFixed(3)} ／ 効果音の山 ${sfx.peak.toFixed(3)} ／ 効果音 ${plan.sfx.length} 個`);
})().catch((e) => { console.error(e); process.exit(1); });
