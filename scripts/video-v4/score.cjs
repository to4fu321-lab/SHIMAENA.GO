// 動画の音楽と効果音を作る。楽器はアプリと同じ lib/sound（Web Audio 合成。音ファイルなし）。書き出しの土台は scripts/video-v3/audio/entry.ts。
// 使い方: node scripts/video-v4/score.cjs → .video/v4/audio/music.wav と sfx.wav
// 音楽の流れ:
//   あいさつ: 風だけ → 静かな朝〜数字: エレピの静かな前奏 → 題字: 鈴 → 10分間の前半: 「しらかばの朝」（アプリの朝の曲）
//   「行く」を押した瞬間から「出撃！」→ 完了の瞬間に「灯りがともる」→ 「ありがとう」に向けて消える → 空けておく所は、風だけ
//   作り方: 「出撃！」の刻み → 決まり: 止める → 「人は、会いに行く。」で和音ひとつ → くっつく〜初雪: 「灯りがともる」の広がる所 → おわりの和音
const { chromium } = require("playwright");
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const V = path.join(ROOT, ".video/v4");
const C = require("./cues.cjs")(V);
const { TL, T, E, L, LE } = C;
const BAR = { morning: (60 / 82) * 4, mission: (60 / 120) * 4, clear: (60 / 100) * 4, prelude: (60 / 66) * 4 };
const seq = (n, f) => Array.from({ length: n }, (_, i) => f(i));

const music = [];
music.push({ kind: "swell", at: 0.2, dur: T("quiet") + 1.5, gain: 0.9, fadeIn: 1.0, fadeOut: 2.0 });
const preAt = T("quiet") + 0.3, preN = Math.max(4, Math.floor((L("c12") - preAt) / BAR.prelude));
music.push({ kind: "prelude", at: preAt, n: preN, gain: 1.15, fadeIn: 1.0, fadeOut: 2.4 });
// 題字の前に、ためてから鳴らす（抑揚: 静か → ためる → 開く）
music.push({ kind: "riser", at: L("c13") - 0.2 - 1.6, dur: 1.6, gain: 0.8 });
music.push({ kind: "fanfare", at: L("c13") - 0.2, gain: 1.2 });
const mEnd = C.goTap - 0.12, mN = Math.max(2, Math.min(8, Math.floor((mEnd - (L("c13") + 1.6)) / BAR.morning)));
music.push({ kind: "song", song: "morning", at: mEnd - mN * BAR.morning, bars: seq(mN, (i) => i), gain: 1.0, fadeIn: 0.8 });
music.push({ kind: "riser", at: C.goTap - 1.55, dur: 1.5, gain: 0.9 });
music.push({ kind: "song", song: "mission", at: C.goTap, bars: seq(Math.ceil((C.clear - C.goTap) / BAR.mission) + 1, (i) => i % 8), gain: 0.92, until: C.clear + 0.05, untilFade: 0.3 });
const cUntil = L("c27") - 0.1;
music.push({ kind: "song", song: "clear", intro: true, at: C.clear + 0.05, bars: seq(Math.ceil((cUntil - C.clear - 1.2) / BAR.clear) + 1, (i) => i % 8), gain: 1.0, until: cUntil, untilFade: Math.min(4.2, cUntil - L("c26") + 0.6) });
music.push({ kind: "swell", at: T("blank") - 0.8, dur: E("blank") - T("blank") + 1.6, gain: 0.55, fadeIn: 1.2, fadeOut: 1.2 });
const kAt = T("maker") + 0.3, kUntil = T("rules") + 0.5, kN = Math.ceil((kUntil - kAt) / BAR.mission);
music.push({ kind: "song", song: "mission", at: kAt, bars: seq(kN, (i) => (i < 6 ? i % 4 : 4 + ((i - 6) % 4))), gain: 0.78, fadeIn: 0.5, until: kUntil, untilFade: 1.2 });
music.push({ kind: "riser", at: L("c37") - 0.25 - 1.4, dur: 1.4, gain: 0.6 });
music.push({ kind: "warm", at: L("c37") - 0.25, dur: T("huddle") - L("c37") + 1.0, gain: 1.15 });
const hAt = T("huddle") + 0.2, endAt = L("c43") - 0.2, wideN = Math.max(2, Math.min(4, Math.round((T("firstsnow") + 1.0 - hAt) / BAR.clear)));
music.push({ kind: "song", song: "clear", at: hAt, bars: seq(wideN, (i) => 12 + i), gain: 1.05, fadeIn: 0.6 });
const qAt = hAt + wideN * BAR.clear;
if (endAt - qAt > 1.2) music.push({ kind: "song", song: "clear", at: qAt, bars: seq(Math.ceil((endAt - qAt) / BAR.clear), (i) => 8 + (i % 4)), gain: 1.0, until: endAt, untilFade: 0.8 });
music.push({ kind: "riser", at: endAt - 1.5, dur: 1.5, gain: 0.75 });
music.push({ kind: "ending", at: endAt, dur: Math.max(5, TL.seconds - endAt - 0.1), gain: 1.2 });

// 効果音（アプリが鳴らすのと同じ音を、同じ瞬間に）
const sfx = [];
const add = (name, at, gain = 1) => sfx.push({ name, at: +at.toFixed(3), gain });
add("flap", 0.45, 0.7); add("chirp", C.land, 0.8);
add("flap", T("title") + 0.15, 0.6); add("chirp", L("c12") + 0.5, 0.7); add("chirp", L("c12") + 0.95, 0.5);
C.askTaps.forEach((t) => add("tap", t, 0.8));
C.arrive.forEach((t, i) => add("message", t, 1.0 - i * 0.15));
[L("c17"), L("c18"), L("c22")].forEach((t) => add("countPop", t - 0.05, 0.5));
add("toast", T("reason") + 0.9, 0.5);
add("go", C.goTap, 1.0);
C.done.forEach((t, i) => add("lamp", t, 0.45 + (i % 2) * 0.1));
add("tap", C.finTap, 0.8); add("shutter", C.shutter, 0.9); C.checks.forEach((t) => add("quizOk", t, 0.45));
add("missionClear", C.clear, 1.0);
add("tap", C.cardTap, 0.7); add("cardFlip", C.cardTap + 0.5, 0.7); add("cardSparkle", T("card") + 2.0, 0.6);
// バトン（渡す → 飛ぶ → 受け取る）と、なかま帳（週ごとに顔見知りが増える）。時刻は act2b-tsunagu.js と同じ式
const vPass = L("c51") + 0.55; add("tap", vPass, 0.7); add("send", vPass + 0.12, 0.8); add("message", vPass + 1.0, 0.7); add("quizOk", vPass + 1.25, 0.45);
const d53 = LE("c53") - L("c53"); add("toast", T("nakama") + 0.7, 0.45);
[0, 1, 2, 3].forEach((w) => add(w === 3 ? "cheer" : "countPop", L("c53") + 0.15 + (w * (d53 + 0.5)) / 4 + 0.15, w === 3 ? 0.5 : 0.55));
// 隊長トーク（送る → 調べる → 答えが届く）・ソロ（GO → 点が入る）。時刻は act2b-tsunagu.js と同じ式
const c60 = L("c60"), vSend = c60 + 0.9, vAns = c60 + (LE("c60") - c60) * 0.6;
add("send", vSend, 0.8); [0, 1, 2].forEach((i) => add("countTick", vSend + 0.55 + i * 0.42, 0.5)); add("message", vAns, 0.9);
const c61 = L("c61"), vGo = c61 + (LE("c61") - c61) * 0.42;
add("go", vGo, 0.7); [0.35, 0.6, 0.85, 1.1].forEach((d) => add("countTick", vGo + d, 0.45)); add("countPop", vGo + 1.35, 0.6);
// 数字（94%・68%）: 上がっていく間はカチカチ、止まったらポン
[[L("c09") + 0.9, 1.6], [L("c10") + 0.1, 1.4]].forEach(([at, d]) => { for (let i = 0; i < 9; i++) add("countTick", at + (d * (1 - Math.pow(1 - i / 9, 2))) * 0.8, 0.32); add("countPop", at + d * 0.85, 0.6); });
// これから（ご近所 → 町内会 → 行政）
[T("gov") + 0.5, L("c62") + 0.7, L("c62") + 2.0].forEach((t, i) => add(i === 2 ? "quizOk" : "toast", t, 0.5));
// カメラが切り替わる所に、小さな風切り音
for (const s of TL.scenes) if (s.start > 1 && !["thanks", "blank", "quiet", "huddle", "end"].includes(s.id)) add("cardRise", s.start - 0.12, 0.28);
add("tap", L("c26") + 0.9, 0.6); add("tap", L("c27") + 0.3, 0.6);
const d32 = LE("c32") - L("c32"); [0, 0.3, 0.66].forEach((k) => add("countPop", L("c32") + d32 * k, 0.55));
add("toast", L("c33") - 0.1, 0.45);
const d36 = LE("c36") - L("c36"); [0, 0.38, 0.68].forEach((k) => add("toggleOff", L("c36") + d36 * k - 0.05, 0.6));
[0.5, 0.15, 0, 0.3, 0.65].forEach((d, i) => add("flap", T("huddle") + 0.15 + d, 0.4));
add("chirp", T("huddle") + 1.2, 0.5);
add("chirp", L("c45") + 1.6, 0.6);

const plan = { seconds: TL.seconds + 0.5, sampleRate: 48000, music, sfx };
(async () => {
  fs.mkdirSync(path.join(V, "audio"), { recursive: true });
  const bundle = path.join(V, "audio/bundle.js");
  await esbuild.build({ entryPoints: [path.join(ROOT, "scripts/video-v3/audio/entry.ts")], bundle: true, format: "iife", outfile: bundle, platform: "browser", target: "es2022", logLevel: "warning" });
  const b = await chromium.launch();
  const sr = plan.sampleRate, N = Math.ceil(plan.seconds * sr);
  const mix = [new Float32Array(N), new Float32Array(N)];
  const jobs = music.map((c, i) => ({ c, i }));
  await Promise.all(Array.from({ length: 4 }, async () => {
    const p = await b.newPage();
    p.on("pageerror", (e) => console.error("page error:", e.message));
    await p.setContent("<html><body></body></html>");
    await p.addScriptTag({ path: bundle });
    for (let job = jobs.shift(); job; job = jobs.shift()) {
      const r = await p.evaluate(([c, sr, i]) => window.renderCue(c, sr, i), [job.c, sr, job.i]);
      const pcm = Buffer.from(r.b64, "base64"), n = pcm.length / 4, off = Math.round(r.offset * sr);
      for (let k = 0; k < n; k++) { const t = off + k; if (t < 0 || t >= N) continue; mix[0][t] += pcm.readInt16LE(k * 4) / 32768; mix[1][t] += pcm.readInt16LE(k * 4 + 2) / 32768; }
    }
    await p.close();
  }));
  const sp = await b.newPage();
  await sp.setContent("<html><body></body></html>");
  await sp.addScriptTag({ path: bundle });
  const sfxOut = await sp.evaluate((plan) => window.renderSfx(plan), plan);
  await b.close();
  const head = (len) => { const h = Buffer.alloc(44); h.write("RIFF", 0); h.writeUInt32LE(36 + len, 4); h.write("WAVE", 8); h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(sr, 24); h.writeUInt32LE(sr * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34); h.write("data", 36); h.writeUInt32LE(len, 40); return h; };
  let peak = 0;
  for (let k = 0; k < N; k++) peak = Math.max(peak, Math.abs(mix[0][k]), Math.abs(mix[1][k]));
  const norm = peak > 0.97 ? 0.97 / peak : 1, out = Buffer.alloc(N * 4);
  for (let k = 0; k < N; k++) { out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[0][k] * norm)) * 32767), k * 4); out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[1][k] * norm)) * 32767), k * 4 + 2); }
  fs.writeFileSync(path.join(V, "audio/music.wav"), Buffer.concat([head(out.length), out]));
  const sfxPcm = Buffer.from(sfxOut.b64, "base64");
  fs.writeFileSync(path.join(V, "audio/sfx.wav"), Buffer.concat([head(sfxPcm.length), sfxPcm]));
  const mmss = (x) => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, "0")}`;
  for (const c of music) console.log(mmss(c.at).padEnd(7), c.kind === "song" ? `${c.song} [${c.bars.join(",")}]` : c.kind, c.until ? `→ ${mmss(c.until)}` : "");
  console.log(`音楽の山 ${peak.toFixed(3)} ／ 効果音 ${sfx.length} 個（山 ${sfxOut.peak.toFixed(3)}）`);
})().catch((e) => { console.error(e); process.exit(1); });
