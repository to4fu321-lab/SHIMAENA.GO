// 声（.video/v3/voice/<id>.wav）＋ 音楽（audio/music.wav）＋ 効果音（audio/sfx.wav）を1本に混ぜ、コマ（out/%05d.jpg）と合わせて MP4 にする。
// 使い方:
//   node scripts/video-v3/mix.cjs audio            … .video/v3/mix.wav を作る
//   node scripts/video-v3/mix.cjs mux [出力.mp4]   … 画と音を1本に（既定 docs/video/shimaena-go-3min.mp4）
//   node scripts/video-v3/mix.cjs reaudio [出力]   … 画はそのまま、音だけ作り直して入れ替える（声を差し替えたとき）
// 音の大きさ: 声を基準に、音楽は声より 10.5 LU 小さく置き、声が鳴っている間はさらに下げる（サイドチェイン）。効果音は山を -10 dB に。
//   声のありがとうの場面は音楽なし（score.cjs が鳴らさない）。最後に全体をネット動画の標準（-14 LUFS）にそろえる。
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const V = path.join(ROOT, ".video/v3");
const TL = JSON.parse(fs.readFileSync(path.join(V, "timeline.json"), "utf8"));
const EDIT = require("./edit.js")(TL);
const OUT_DEFAULT = path.join(ROOT, "docs/video/shimaena-go-3min.mp4");
const cmd = process.argv[2] || "audio";
const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args], { stdio: "inherit" });
/** 全体の大きさ（LUFS）を測る */
function lufs(file, filter = "anull") {
  const log = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-af", `${filter},loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json`, "-f", "null", "-"], { encoding: "utf8" }).stderr;
  return JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));
}
const db = (x) => Math.pow(10, x / 20);

function audio() {
  const sec = TL.seconds;
  // 1) 声だけの帯
  const lines = TL.scenes.flatMap((s) => s.lines);
  const inputs = [], parts = [];
  const gain = { narr: 1.0, captain: 0.9, grand: 1.0 };
  lines.forEach((l, i) => {
    inputs.push("-i", path.join(V, "voice", l.id + ".wav"));
    const ms = Math.round(l.at * 1000);
    parts.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,volume=${gain[l.who] ?? 1},adelay=${ms}|${ms},apad=whole_dur=${sec}[v${i}]`);
  });
  parts.push(lines.map((_, i) => `[v${i}]`).join("") + `amix=inputs=${lines.length}:normalize=0:dropout_transition=0[voice]`);
  const voice = path.join(V, "voice-bus.wav");
  ff([...inputs, "-filter_complex", parts.join(";"), "-map", "[voice]", "-t", String(sec), "-ar", "48000", "-ac", "2", voice]);
  // 2) 大きさを測って、音楽と効果音の置き場所を決める
  const vI = +lufs(voice).input_i, mI = +lufs(path.join(V, "audio/music.wav")).input_i;
  const vGain = db(-17 - vI); // 声を -17 LUFS に
  const mGain = db(-17 - 10.5 - mI); // 音楽は声より 10.5 LU 下（声の間はサイドチェインでさらに下がる）
  // 効果音はまばらなので、全体の大きさではなく山（いちばん大きい所）を -10 dB に合わせる
  const sPeak = +(spawnSync("ffmpeg", ["-hide_banner", "-i", path.join(V, "audio/sfx.wav"), "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr.match(/max_volume: ([-\d.]+) dB/) || [0, -8])[1];
  const sGain = db(-10 - sPeak);
  // 場面ごとの音楽の上げ下げ（章の頭・題字・数字・終わりは少し前へ、説明が続く Claude の章は控えめに）
  const sc = EDIT.scene;
  const env = [[0, 1.0], [sc.title.start - 0.3, 1.0], [sc.title.start, 1.25], [sc.ask.start, 1.0], [sc.thanks.start, 0.9], [sc.principle.start, 1.2], [sc.more.start, 1.0], [sc.maker.start, 0.78], [sc.depth.start - 0.3, 0.78], [sc.depth.start, 1.05], [sc.future.start, 1.2], [sc.end.start, 1.35], [sec - 1.6, 1.35], [sec - 0.05, 0]];
  let expr = String(env[env.length - 1][1]);
  for (let i = env.length - 2; i >= 0; i--) { const [a, va] = env[i], [b, vb] = env[i + 1]; expr = `if(lt(t,${b.toFixed(2)}),${va}+(${vb}-${va})*(t-${a.toFixed(2)})/${Math.max(0.01, b - a).toFixed(2)},${expr})`; }
  const fc = [
    `[0:a]volume=${vGain.toFixed(4)},asplit=2[voice][key]`,
    `[1:a]atrim=0:${sec},asetpts=PTS-STARTPTS,volume=${mGain.toFixed(4)},volume='${expr}':eval=frame[m0]`,
    `[m0][key]sidechaincompress=threshold=0.035:ratio=4:attack=60:release=700:makeup=1[m1]`,
    `[2:a]atrim=0:${sec},asetpts=PTS-STARTPTS,volume=${sGain.toFixed(4)}[sfx]`,
    `[voice][m1][sfx]amix=inputs=3:normalize=0:dropout_transition=0,alimiter=limit=0.94:attack=3:release=60[out]`,
  ];
  const raw = path.join(V, "mix-raw.wav");
  ff(["-i", voice, "-i", path.join(V, "audio/music.wav"), "-i", path.join(V, "audio/sfx.wav"), "-filter_complex", fc.join(";"), "-map", "[out]", "-t", String(sec), "-ar", "48000", "-ac", "2", raw]);
  // 3) 仕上げ: -14 LUFS にそろえる（測ってから、その値で一様に上げる）
  const LN = "I=-14:TP=-1.5:LRA=11";
  const m = lufs(raw);
  ff(["-i", raw, "-af", `loudnorm=${LN}:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`, "-ar", "48000", "-ac", "2", path.join(V, "mix.wav")]);
  const f = lufs(path.join(V, "mix.wav"));
  console.log(`声 ${vI} LUFS ／ 音楽 ${mI} ／ 効果音の山 ${sPeak} dB → 混ぜた音 ${m.input_i} → 仕上げ ${f.input_i} LUFS（山 ${f.input_tp} dBTP）`);
}

function mux(out = OUT_DEFAULT) {
  ff(["-framerate", String(TL.fps), "-i", path.join(V, "out/%05d.jpg"), "-i", path.join(V, "mix.wav"), "-t", String(TL.seconds), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "22", "-preset", "slow", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]);
  const d = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size", "-of", "csv=p=0", out], { encoding: "utf8" }).stdout.trim();
  console.log("できた:", out, d);
}

if (cmd === "audio") audio();
else if (cmd === "mux") mux(process.argv[3]);
else if (cmd === "reaudio") {
  audio();
  const out = process.argv[3] || OUT_DEFAULT, tmp = out + ".tmp.mp4";
  ff(["-i", out, "-i", path.join(V, "mix.wav"), "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", String(TL.seconds), "-movflags", "+faststart", tmp]);
  fs.renameSync(tmp, out);
  console.log("音を入れ替えた:", out);
}
