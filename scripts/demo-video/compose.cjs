// デモ動画を組み立てる: 録画のコマ出し → 合成ページを1コマずつ撮る → ナレーション＋BGM を混ぜる → MP4。
// 使い方:
//   node scripts/demo-video/compose.cjs prep                 … 録画（.video/rec）を 30fps のコマに分け、.video/timeline.js を書く
//   node scripts/demo-video/compose.cjs preview 5,21,30,60   … その秒のコマだけ PNG にして確かめる（.video/preview/）
//   node scripts/demo-video/compose.cjs render               … 全コマを撮る（.video/out/%05d.jpg）
//   node scripts/demo-video/compose.cjs audio                … .video/mix.wav（ナレーション・隊長・娘さんの声 ＋ BGM）
//   node scripts/demo-video/compose.cjs mux [出力.mp4]       … 画と音を1本に（既定 docs/video/demo3min-v2.mp4）
//   node scripts/demo-video/compose.cjs all [出力.mp4]
const { chromium } = require("playwright");
const { execFileSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.resolve(__dirname, "../..");
const V = path.join(ROOT, ".video");
const T = require("./timeline.cjs");
const HTML = path.join(__dirname, "compose.html");
const cmd = process.argv[2] || "all";
const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args], { stdio: "inherit" });

function prep() {
  const scenes = JSON.parse(fs.readFileSync(path.join(V, "rec/scenes.json"), "utf8"));
  const frames = {};
  for (const [name, s] of Object.entries(scenes)) {
    const dir = path.join(V, "frames", name);
    fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
    ff(["-i", path.join(V, "rec", s.file), "-vf", `fps=${T.fps}`, "-q:v", "3", path.join(dir, "%05d.jpg")]);
    frames[name] = fs.readdirSync(dir).length;
    console.log("コマ出し:", name, frames[name]);
  }
  const narration = JSON.parse(fs.readFileSync(path.join(V, "narration/narration.json"), "utf8"));
  const commits = fs.existsSync(path.join(V, "commits.txt")) ? fs.readFileSync(path.join(V, "commits.txt"), "utf8").split("\n").filter(Boolean) : [];
  fs.writeFileSync(path.join(V, "timeline.js"), "window.TIMELINE = " + JSON.stringify({ ...T, frames, narration, commits }) + ";\n");
  console.log("timeline.js を書いた");
}

async function shots(times, outDir, workers = Math.min(4, os.cpus().length)) {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  let done = 0;
  await Promise.all(Array.from({ length: workers }, async (_, w) => {
    const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    await p.goto("file://" + HTML + "?render=1");
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(500);
    for (let i = w; i < times.length; i += workers) {
      const [t, file] = times[i];
      await p.evaluate((t) => seek(t), t);
      await p.screenshot({ path: path.join(outDir, file), type: file.endsWith(".png") ? "png" : "jpeg", quality: file.endsWith(".png") ? undefined : 93 });
      if (++done % 300 === 0) console.log(`${done}/${times.length}`);
    }
  }));
  await b.close();
}

async function preview(list) {
  const times = list.split(",").map(Number).map((t) => [t, `t${String(t).replace(".", "_")}.png`]);
  await shots(times, path.join(V, "preview"), 2);
  console.log("preview:", path.join(V, "preview"));
}

async function render() {
  const out = path.join(V, "out"); fs.rmSync(out, { recursive: true, force: true });
  const N = T.fps * T.seconds;
  const times = Array.from({ length: N }, (_, i) => [i / T.fps, String(i).padStart(5, "0") + ".jpg"]);
  await shots(times, out);
  console.log("コマ:", N);
}

// 音: ナレーション（各行を置く）＋ BGM（声の間は小さく、ありがとうの場面は無音）
function audio() {
  const narration = JSON.parse(fs.readFileSync(path.join(V, "narration/narration.json"), "utf8"));
  const inputs = ["-i", path.join(ROOT, "docs/video/bgm.mp3")];
  const voices = [];
  for (const s of T.scenes) for (const [id, at] of s.voice) { voices.push({ id, at, who: narration[id].who }); }
  voices.forEach((v) => inputs.push("-i", path.join(V, "narration", v.id + ".wav")));
  const parts = [];
  const gain = { narr: 1.0, captain: 0.9, daughter: 0.95 };
  voices.forEach((v, i) => parts.push(`[${i + 1}:a]volume=${gain[v.who]},adelay=${Math.round(v.at * 1000)}|${Math.round(v.at * 1000)},apad=whole_dur=${T.seconds}[v${i}]`));
  parts.push(voices.map((_, i) => `[v${i}]`).join("") + `amix=inputs=${voices.length}:normalize=0:dropout_transition=0,asplit=2[voice][sc]`);
  // BGM の大きさ: 前半は静かに、声の間はダッキング、ありがとうの場面（off）は無音、最後はフェードアウト
  const { quietUntil, off, fadeOutAt } = T.bgm;
  const lin = (a, b, va, vb) => `(${va}+(${vb}-${va})*(t-${a})/(${b}-${a}))`;
  const vol = `if(lt(t,${quietUntil}),0.42,if(lt(t,${quietUntil + 2}),${lin(quietUntil, quietUntil + 2, 0.42, 0.62)},if(lt(t,${off[0] - 2}),0.62,if(lt(t,${off[0]}),${lin(off[0] - 2, off[0], 0.62, 0)},if(lt(t,${off[1]}),0,if(lt(t,${off[1] + 2}),${lin(off[1], off[1] + 2, 0, 0.62)},if(lt(t,${fadeOutAt}),0.62,${lin(fadeOutAt, T.seconds, 0.62, 0)})))))))`;
  parts.push(`[0:a]atrim=0:${T.seconds},asetpts=PTS-STARTPTS,volume='${vol}':eval=frame[bgm0]`);
  parts.push(`[bgm0][sc]sidechaincompress=threshold=0.03:ratio=6:attack=40:release=600:makeup=1[bgm]`);
  parts.push(`[bgm][voice]amix=inputs=2:normalize=0:dropout_transition=0,alimiter=limit=0.95[out]`);
  ff([...inputs, "-filter_complex", parts.join(";"), "-map", "[out]", "-t", String(T.seconds), "-ar", "48000", "-ac", "2", path.join(V, "mix.wav")]);
  console.log("mix.wav を書いた");
}

function mux(out = path.join(ROOT, "docs/video/demo3min-v2.mp4")) {
  ff(["-framerate", String(T.fps), "-i", path.join(V, "out/%05d.jpg"), "-i", path.join(V, "mix.wav"), "-t", String(T.seconds), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21", "-preset", "medium", "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out]);
  console.log("できた:", out);
}

(async () => {
  if (cmd === "prep") prep();
  else if (cmd === "preview") await preview(process.argv[3] || "5,21,30,60");
  else if (cmd === "render") await render();
  else if (cmd === "audio") audio();
  else if (cmd === "mux") mux(process.argv[3]);
  else { prep(); await render(); audio(); mux(process.argv[3]); }
})().catch((e) => { console.error(e); process.exit(1); });
