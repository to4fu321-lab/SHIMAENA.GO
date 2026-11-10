// 台本（script.cjs）のナレーションを、合成音声で作る（仮の声）。本人の声で録った wav を置けば、そちらを使う。
// 使い方:
//   node scripts/video-v3/narrate.cjs            … まだない行・文が変わった行だけ作る → .video/v3/voice/<id>.wav と voice.json（長さ）
//   node scripts/video-v3/narrate.cjs n12,n13    … その行だけ作り直す
//   TTS_DIR=<synth.py のある場所> で、合成の道具（scripts/video-v3/tts/README.md）の場所を変えられる
// 本人の声に差し替えるとき: .video/v3/own/<id>.wav（または .m4a/.mp3）を置いて、もう一度これを実行 → layout → render → mix
//   （own にある行は合成しない。長さは自動で測り直し、時間割もそれに合わせて組み直される）
const { execFileSync, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const V = path.join(ROOT, ".video/v3");
const OUT = path.join(V, "voice");
const OWN = path.join(V, "own");
const RAW = path.join(OUT, "raw");
const S = require("./script.cjs");
const VOICES = require("./voices.cjs");
const TTS = process.env.TTS_DIR || VOICES.ttsDir;
fs.mkdirSync(RAW, { recursive: true });

const only = process.argv[2] ? process.argv[2].split(",") : null;
const metaFile = path.join(OUT, "voice.json");
const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, "utf8")) : {};
const dur = (f) => +spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout.trim();
const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args]);
// 頭と終わりの無音を切り、48kHz ステレオに。声の大きさは行ごとにそろえる（-20 dB RMS は synth.py 側）
const TRIM = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse";

const lines = S.scenes.flatMap((s) => s.lines);
const todo = [];
for (const l of lines) {
  const v = { ...VOICES[l.who], ...(VOICES.lines?.[l.id] || {}) };
  const own = [".wav", ".m4a", ".mp3"].map((e) => path.join(OWN, l.id + e)).find((f) => fs.existsSync(f));
  const key = crypto.createHash("sha1").update(JSON.stringify(own ? { own, m: fs.statSync(own).mtimeMs } : { say: l.say, v })).digest("hex").slice(0, 12);
  const out = path.join(OUT, l.id + ".wav");
  if (!(only ? only.includes(l.id) : !fs.existsSync(out) || meta[l.id]?.key !== key)) continue;
  if (own) {
    ff(["-i", own, "-af", `${TRIM},loudnorm=I=-19:TP=-2:LRA=7`, "-ar", "48000", "-ac", "2", out]);
    meta[l.id] = { key, who: l.who, own: true, seconds: +dur(out).toFixed(3) };
    console.log(`${l.id} 本人の声  ${meta[l.id].seconds}s`);
  } else todo.push({ l, v, key, out });
}

if (todo.length) {
  const batch = path.join(RAW, "lines.json");
  fs.writeFileSync(batch, JSON.stringify(todo.map(({ l, v }) => ({ id: l.id, text: l.say, rms_db: -20, ...v })), null, 1));
  const r = spawnSync(path.join(TTS, "venv/bin/python"), [path.join(TTS, "synth.py"), "--batch", batch, "--outdir", RAW], { cwd: TTS, stdio: ["ignore", "inherit", "inherit"] });
  if (r.status !== 0) { console.error("合成に失敗しました。scripts/video-v3/tts/README.md を見て、合成の道具を用意してください。"); process.exit(1); }
  for (const { l, v, key, out } of todo) {
    ff(["-i", path.join(RAW, l.id + ".wav"), "-af", `${TRIM}${v.post ? "," + v.post : ""}`, "-ar", "48000", "-ac", "2", out]);
    meta[l.id] = { key, who: l.who, voice: v.model, seconds: +dur(out).toFixed(3) };
    console.log(`${l.id} ${l.who.padEnd(6)} ${String(meta[l.id].seconds).padStart(6)}s  ${l.text.replace(/／/g, "")}`);
  }
}
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
const total = lines.reduce((a, l) => a + (meta[l.id]?.seconds || 0), 0);
console.log(`声の合計 ${total.toFixed(1)} 秒（${lines.length} 行）`);
