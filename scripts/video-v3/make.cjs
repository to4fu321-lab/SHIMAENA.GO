// 紹介動画（3分・v3）を、材料から通しで作る。
// 使い方（先に `npm install` と `npm run build`）:
//   node scripts/video-v3/make.cjs            … 録画と声があれば、時間割 → 音楽 → 全コマ → 音 → MP4（約7分）
//   node scripts/video-v3/make.cjs record     … アプリの画面を録り直してから、上と同じ（＋3分）
//   node scripts/video-v3/make.cjs voice      … 合成の声を作り直してから、上と同じ（合成の道具が要る: tts/README.md）
//   node scripts/video-v3/make.cjs audio      … 画はそのまま、音だけ作り直して入れ替える（声や音楽を直したとき。秒数が変わらないとき）
// できるもの: docs/video/shimaena-go-3min.mp4（1920×1080・30fps・3分以内）
// 材料: 台本 script.cjs ／ 声の設定 voices.cjs ／ 編集の割り付け edit.js ／ 場面の絵 compose-*.js ／ 音楽 score.cjs・audio/entry.ts
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const V = path.join(ROOT, ".video/v3");
const what = process.argv[2] || "all";
const run = (file, ...args) => {
  console.log(`\n── ${file} ${args.join(" ")}`);
  const r = spawnSync("node", [path.join(__dirname, file), ...args], { cwd: ROOT, stdio: "inherit" });
  if (r.status !== 0) { console.error(`${file} で止まりました`); process.exit(1); }
};

// フォント（Zen Maru Gothic・Noto Sans JP・JetBrains Mono。どれも SIL OFL）。なければ取ってくる
const fonts = { "ZenMaruGothic-Regular.ttf": "zenmarugothic/ZenMaruGothic-Regular.ttf", "ZenMaruGothic-Medium.ttf": "zenmarugothic/ZenMaruGothic-Medium.ttf", "ZenMaruGothic-Bold.ttf": "zenmarugothic/ZenMaruGothic-Bold.ttf", "ZenMaruGothic-Black.ttf": "zenmarugothic/ZenMaruGothic-Black.ttf", "NotoSansJP.ttf": "notosansjp/NotoSansJP%5Bwght%5D.ttf", "JetBrainsMono.ttf": "jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf" };
fs.mkdirSync(path.join(V, "fonts"), { recursive: true });
for (const [name, src] of Object.entries(fonts)) {
  const f = path.join(V, "fonts", name);
  if (fs.existsSync(f)) continue;
  console.log("フォントを取ってきます:", name);
  const r = spawnSync("curl", ["-sSfL", "-o", f, `https://raw.githubusercontent.com/google/fonts/main/ofl/${src}`], { stdio: "inherit" });
  if (r.status !== 0) { console.error("フォントが取れませんでした:", name); process.exit(1); }
}
// 最後の画面の QR（デモの入口）。なければ作る（python の qrcode）
if (!fs.existsSync(path.join(V, "qr.svg"))) {
  const py = `import qrcode, qrcode.image.svg\nqrcode.make('https://shimaena-go.vercel.app/demo', image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2).save(r'${path.join(V, "qr.svg")}')`;
  const r = spawnSync("python3", ["-c", py], { stdio: "inherit" });
  if (r.status !== 0) { console.error("QR が作れませんでした（pip install qrcode）"); process.exit(1); }
}

if (what === "record") run("record.cjs");
if (what === "voice") run("narrate.cjs");
if (!fs.existsSync(path.join(V, "rec/scenes.json"))) run("record.cjs");
if (!fs.existsSync(path.join(V, "voice/voice.json"))) run("narrate.cjs");
run("layout.cjs");
run("score.cjs");
if (what === "audio") run("mix.cjs", "reaudio");
else {
  fs.rmSync(path.join(V, "out"), { recursive: true, force: true });
  run("render.cjs", "all");
  run("mix.cjs", "audio");
  run("mix.cjs", "mux");
}
