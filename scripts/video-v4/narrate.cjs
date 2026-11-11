// 台本（script.cjs）の語りを、隊長の声で合成する。
// 声の設定は voice.cjs（聞き取りやすさで選んだ「まい」）。手元で動く合成の道具は scripts/video-v3/tts（README を見て setup.sh）。
//   node scripts/video-v4/narrate.cjs          … まだない行・文が変わった行だけ作る → .video/v4/voice/<id>.wav と voice.json（長さ）
//   node scripts/video-v4/narrate.cjs c12,c13  … その行だけ作り直す
const { execFileSync, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const V = path.join(ROOT, ".video/v4");
const OUT = path.join(V, "voice"), RAW = path.join(OUT, "raw");
const S = require("./script.cjs");
const VOICE = require("./voice.cjs");
const TTS = process.env.TTS_DIR || path.join(ROOT, "scripts/video-v3/tts");
fs.mkdirSync(RAW, { recursive: true });

const only = process.argv[2] ? process.argv[2].split(",") : null;
const metaFile = path.join(OUT, "voice.json");
const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, "utf8")) : {};
const dur = (f) => +spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], { encoding: "utf8" }).stdout.trim();
// 頭と終わりの無音を切り、48kHz ステレオに
const TRIM = "silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.03,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.08,areverse";

const lines = S.scenes.flatMap((s) => s.lines);
const todo = [];
for (const l of lines) {
  const v = { ...VOICE.base, ...(VOICE.lines[l.id] || {}) };
  const key = crypto.createHash("sha1").update(JSON.stringify({ say: l.say, v })).digest("hex").slice(0, 12);
  const out = path.join(OUT, l.id + ".wav");
  if (only ? only.includes(l.id) : !fs.existsSync(out) || meta[l.id]?.key !== key) todo.push({ l, v, key, out });
}
if (todo.length) {
  const batch = path.join(RAW, "lines.json");
  fs.writeFileSync(batch, JSON.stringify(todo.map(({ l, v }) => ({ id: l.id, text: l.say, rms_db: -20, ...v })), null, 1));
  const r = spawnSync(path.join(TTS, "venv/bin/python"), [path.join(TTS, "synth.py"), "--batch", batch, "--outdir", RAW], { cwd: TTS, stdio: ["ignore", "inherit", "inherit"], env: { ...process.env, OMP_WAIT_POLICY: "PASSIVE" } });
  if (r.status !== 0) { console.error("合成に失敗しました（scripts/video-v3/tts/README.md）"); process.exit(1); }
  for (const { l, v, key, out } of todo) {
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", path.join(RAW, l.id + ".wav"), "-af", TRIM + (v.post ? "," + v.post : ""), "-ar", "48000", "-ac", "2", out]);
    meta[l.id] = { key, seconds: +dur(out).toFixed(3) };
    console.log(`${l.id} ${String(meta[l.id].seconds).padStart(6)}s  ${l.text.replace(/\n/g, " ")}`);
  }
}
fs.writeFileSync(metaFile, JSON.stringify(meta, null, 1));
console.log(`声の合計 ${lines.reduce((a, l) => a + (meta[l.id]?.seconds || 0), 0).toFixed(1)} 秒（${lines.length} 行）`);
