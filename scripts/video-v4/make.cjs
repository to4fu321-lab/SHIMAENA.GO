// 紹介動画 v4「隊長の朝」を、材料から通しで作る。
// 使い方（先に `npm install` と `npm run build`。声を作り直すときは scripts/video-v3/tts/README.md の用意も）:
//   node scripts/video-v4/make.cjs          … 時間割 → 音楽 → 全コマ → 音 → MP4（約8分）
//   node scripts/video-v4/make.cjs record   … アプリの画面を録り直してから、上と同じ
//   node scripts/video-v4/make.cjs voice    … 隊長の声を作り直してから、上と同じ
//   node scripts/video-v4/make.cjs audio    … 画はそのまま、音だけ作り直して入れ替える
// できるもの: docs/video/shimaena-go-taicho.mp4（1920×1080・30fps・3分以内）
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const V = path.join(ROOT, ".video/v4");
const what = process.argv[2] || "all";
const run = (file, ...args) => {
  console.log(`\n── ${file} ${args.join(" ")}`);
  if (spawnSync("node", [path.join(__dirname, file), ...args], { cwd: ROOT, stdio: "inherit" }).status !== 0) { console.error(`${file} で止まりました`); process.exit(1); }
};
// フォント（どれも SIL OFL）。なければ取ってくる
const fonts = { "ZenMaruGothic-Medium.ttf": "zenmarugothic/ZenMaruGothic-Medium.ttf", "ZenMaruGothic-Bold.ttf": "zenmarugothic/ZenMaruGothic-Bold.ttf", "ZenMaruGothic-Black.ttf": "zenmarugothic/ZenMaruGothic-Black.ttf", "NotoSansJP.ttf": "notosansjp/NotoSansJP%5Bwght%5D.ttf", "JetBrainsMono.ttf": "jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf", "ShipporiMincho-Bold.ttf": "shipporimincho/ShipporiMincho-Bold.ttf" };
fs.mkdirSync(path.join(V, "fonts"), { recursive: true });
for (const [name, src] of Object.entries(fonts)) {
  const f = path.join(V, "fonts", name);
  if (fs.existsSync(f)) continue;
  if (spawnSync("curl", ["-sSfL", "-o", f, `https://raw.githubusercontent.com/google/fonts/main/ofl/${src}`], { stdio: "inherit" }).status !== 0) { console.error("フォントが取れませんでした:", name); process.exit(1); }
}
// 最後の画面の QR（登録なしのデモへ）。なければ作る（pip install qrcode）
if (!fs.existsSync(path.join(V, "qr.svg"))) {
  const py = `import qrcode, qrcode.image.svg\nqrcode.make('https://shimaena-go.vercel.app/demo', image_factory=qrcode.image.svg.SvgPathImage, box_size=10, border=2).save(r'${path.join(V, "qr.svg")}')`;
  if (spawnSync("python3", ["-c", py], { stdio: "inherit" }).status !== 0) { console.error("QR が作れませんでした（pip install qrcode）"); process.exit(1); }
}
if (what === "record" || !fs.existsSync(path.join(V, "rec/scenes.json"))) run("record.cjs");
if (what === "voice" || !fs.existsSync(path.join(V, "voice/voice.json"))) run("narrate.cjs");
run("layout.cjs");
run("score.cjs");
if (what === "audio") run("mix.cjs", "reaudio");
else {
  fs.rmSync(path.join(V, "out"), { recursive: true, force: true });
  run("render.cjs", "all");
  run("mix.cjs", "audio");
  run("mix.cjs", "mux");
}
