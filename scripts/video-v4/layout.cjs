// 台本（script.cjs）と声の長さ（voice.json）から、時間割を作る → .video/v4/timeline.json と timeline.js（合成ページ用）
// あわせて: 声の大きさの波（隊長がしゃべる動きに使う）と、画面に流す本物のコミットの題名（git log）も書き出す。
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const V = path.join(ROOT, ".video/v4");
const S = require("./script.cjs");
const voice = JSON.parse(fs.readFileSync(path.join(V, "voice/voice.json"), "utf8"));
const fps = S.fps;
const snap = (x) => Math.round(x * fps) / fps;

let t = 0;
const scenes = S.scenes.map((s) => {
  const start = t;
  const P = S.pace ?? 1;
  let c = start + (s.lead ?? 0.5) * P;
  const lines = s.lines.map((l, i) => {
    if (i > 0) c += (l.gap ?? 0.35) * P; else if (l.gap) c += l.gap * P;
    const at = snap(c), sec = voice[l.id]?.seconds;
    if (!sec) throw new Error("声がありません: " + l.id + "（先に narrate.cjs）");
    c = at + sec;
    return { id: l.id, at, end: +c.toFixed(3), text: l.text };
  });
  t = snap(c + (s.tail ?? 0.5) * P + (s.hold ?? 0));
  return { id: s.id, start, end: t, lines };
});
const seconds = t;

// 声の大きさ（1コマごと 0〜1）。隊長のくちばしと体の動きに使う
const env = new Array(Math.ceil(seconds * fps) + 1).fill(0);
for (const sc of scenes) for (const l of sc.lines) {
  const pcm = execFileSync("ffmpeg", ["-v", "error", "-i", path.join(V, "voice", l.id + ".wav"), "-ac", "1", "-ar", "12000", "-f", "s16le", "-"], { maxBuffer: 1 << 28 });
  const per = 12000 / fps, n = Math.floor(pcm.length / 2 / per);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let k = 0; k < per; k++) { const v = pcm.readInt16LE(2 * Math.floor(i * per + k)) / 32768; sum += v * v; }
    const f = Math.round(l.at * fps) + i;
    if (f < env.length) env[f] = Math.max(env[f], Math.min(1, Math.sqrt(sum / per) * 6));
  }
}
// 本物のコミットの題名（11/2〜11/8。新しい順に 60 件）
const log = spawnSync("git", ["log", "--no-merges", "--since=2026-11-02T00:00:00+09:00", "--until=2026-11-08T23:59:59+09:00", "--format=%h\t%ad\t%s", "--date=format:%m/%d %H:%M", "-n", "400"], { cwd: ROOT, encoding: "utf8" }).stdout.trim().split("\n").filter(Boolean)
  .map((l) => { const [h, d, s] = l.split("\t"); return { h, d, s: s.slice(0, 46) }; });
const commits = log.filter((_, i) => i % Math.max(1, Math.floor(log.length / 60)) === 0).slice(0, 60);

const TL = { fps, seconds, scenes, env: env.map((v) => +v.toFixed(2)), commits, commitCount: log.length };
fs.writeFileSync(path.join(V, "timeline.json"), JSON.stringify(TL));
const rec = fs.existsSync(path.join(V, "rec/scenes.json")) ? fs.readFileSync(path.join(V, "rec/scenes.json"), "utf8") : "{}";
fs.writeFileSync(path.join(V, "timeline.js"), `window.TL=${JSON.stringify(TL)};\nwindow.REC=${rec};\n`);
const mmss = (x) => `${Math.floor(x / 60)}:${(x % 60).toFixed(1).padStart(4, "0")}`;
for (const s of scenes) console.log(mmss(s.start).padEnd(7), s.id.padEnd(10), (s.end - s.start).toFixed(1).padStart(5) + "s", s.lines.map((l) => l.id).join(" "));
console.log(`全体 ${mmss(seconds)}（${seconds.toFixed(2)} 秒）／コミット ${log.length} 件`);
if (seconds > S.max) { console.error(`長すぎます: ${seconds.toFixed(1)} 秒 > ${S.max} 秒。台本を縮めてください。`); process.exit(1); }
