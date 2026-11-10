// 台本（script.cjs）と声の長さ（.video/v3/voice/voice.json）から、時間割 .video/v3/timeline.json / timeline.js を作る。
// 使い方: node scripts/video-v3/layout.cjs   （声を録り直したら、もう一度これ → render → mix）
// 声の長さがまだない行は、文字数から見積もる（1秒 6.2 字）。合計が 180 秒を超えたら止まる。
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const ROOT = path.resolve(__dirname, "../..");
const V = path.join(ROOT, ".video/v3");
const S = require("./script.cjs");

const voiceFile = path.join(V, "voice/voice.json");
const voice = fs.existsSync(voiceFile) ? JSON.parse(fs.readFileSync(voiceFile, "utf8")) : {};
const estimate = (text) => +(text.replace(/[、。「」／\s]/g, "").length / 6.2 + 0.25).toFixed(2);

let t = 0;
const scenes = [];
let guessed = 0;
for (const sc of S.scenes) {
  const start = t;
  let cur = start + (sc.lead ?? 0.3);
  const lines = [];
  sc.lines.forEach((ln, i) => {
    if (i > 0) cur += ln.gap ?? 0.25;
    const dur = voice[ln.id]?.seconds ?? (guessed++, estimate(ln.text));
    lines.push({ id: ln.id, who: ln.who, text: ln.text, at: +cur.toFixed(3), dur });
    cur += dur;
  });
  const end = Math.max(cur + (sc.tail ?? 0.4), start + (sc.min ?? 0));
  scenes.push({ id: sc.id, chapter: sc.chapter, start: +start.toFixed(3), end: +end.toFixed(3), lines });
  t = end;
}
const seconds = +t.toFixed(3);

// 記録（合成で使う本物の材料）
const git = (args) => { try { return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 }).trim(); } catch { return ""; } };
const commits = git(["log", "--no-merges", "--format=%ad|%s", "--date=format:%m/%d %H:%M", "--until=2026-11-09T00:00:00+09:00", "-n", "400"]).split("\n").filter(Boolean)
  .map((l) => { const i = l.indexOf("|"); return { at: l.slice(0, i), text: l.slice(i + 1) }; });
const rec = fs.existsSync(path.join(V, "rec/scenes.json")) ? JSON.parse(fs.readFileSync(path.join(V, "rec/scenes.json"), "utf8")) : {};
const screens = fs.readdirSync(path.join(ROOT, "docs/screens")).filter((f) => f.endsWith(".png"));

// 声のありがとうの波: 声の大きさを1コマごとに測る（合成ページで、声に合わせて波が動く）
const VOICES = require("./voices.cjs");
const env = {};
for (const sc of scenes) for (const l of sc.lines) {
  if (l.who !== "grand") continue;
  const f = path.join(V, "voice", l.id + ".wav");
  if (!fs.existsSync(f)) continue;
  const buf = fs.readFileSync(f), data = buf.indexOf("data") + 8, sr = buf.readUInt32LE(24), ch = buf.readUInt16LE(22);
  const n = Math.floor((buf.length - data) / (2 * ch)), hop = Math.round(sr / S.fps), out = [];
  for (let i = 0; i < n; i += hop) { let a = 0, c = 0; for (let k = i; k < Math.min(n, i + hop); k++) { const v = buf.readInt16LE(data + k * 2 * ch) / 32768; a += v * v; c++; } out.push(Math.sqrt(a / Math.max(1, c))); }
  const mx = Math.max(...out, 1e-6);
  env[l.id] = out.map((v) => +Math.min(1, Math.pow(v / mx, 0.6)).toFixed(3));
}

const TL = { fps: S.fps, seconds, scenes, rec, commits, screens, guessed, env, credits: VOICES.credits, voiceNote: VOICES.voiceNote };
fs.mkdirSync(V, { recursive: true });
fs.writeFileSync(path.join(V, "timeline.json"), JSON.stringify(TL, null, 1));
fs.writeFileSync(path.join(V, "timeline.js"), "window.TL = " + JSON.stringify(TL) + ";\n");

const mmss = (x) => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, "0")}`;
for (const sc of scenes) console.log(`${mmss(sc.start)} - ${mmss(sc.end)}  (${(sc.end - sc.start).toFixed(1)}s)  ${sc.id}`);
console.log(`合計 ${seconds.toFixed(1)} 秒（上限 ${S.maxSeconds}）${guessed ? ` ※ ${guessed} 行は見積もり` : ""}`);
if (seconds > S.maxSeconds) { console.error("180 秒を超えています。台本を削るか、間を詰めてください。"); process.exit(1); }
