// 声 ＋ 音楽 ＋ 効果音を1本に混ぜ、コマ（out/%05d.jpg）と合わせて MP4 にする。
//   node scripts/video-v4/mix.cjs audio | mux [出力.mp4] | reaudio [出力.mp4]
// 声を基準に、音楽は声より 10.5 LU 小さく置き、声が鳴っている間はさらに下げる。全体は -14 LUFS（ネット動画の標準）。
const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "../..");
const V = path.join(ROOT, ".video/v4");
const C = require("./cues.cjs")(V);
const { TL, T, E, L } = C;
const OUT_DEFAULT = path.join(ROOT, "docs/video/shimaena-go-taicho.mp4");
const cmd = process.argv[2] || "audio";
const ff = (args) => execFileSync("ffmpeg", ["-y", "-v", "error", ...args], { stdio: "inherit" });
function lufs(file) {
  const log = spawnSync("ffmpeg", ["-hide_banner", "-i", file, "-af", "loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8" }).stderr;
  return JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));
}
const db = (x) => Math.pow(10, x / 20);

function audio() {
  const sec = TL.seconds, lines = TL.scenes.flatMap((s) => s.lines), inputs = [], parts = [];
  lines.forEach((l, i) => {
    inputs.push("-i", path.join(V, "voice", l.id + ".wav"));
    const ms = Math.round(l.at * 1000);
    parts.push(`[${i}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${ms}|${ms},apad=whole_dur=${sec}[v${i}]`);
  });
  parts.push(lines.map((_, i) => `[v${i}]`).join("") + `amix=inputs=${lines.length}:normalize=0:dropout_transition=0[voice]`);
  const voice = path.join(V, "voice-bus.wav");
  ff([...inputs, "-filter_complex", parts.join(";"), "-map", "[voice]", "-t", String(sec), "-ar", "48000", "-ac", "2", voice]);
  const vI = +lufs(voice).input_i, mI = +lufs(path.join(V, "audio/music.wav")).input_i;
  const vGain = db(-17 - vI), mGain = db(-17 - 10.5 - mI);
  const sPeak = +(spawnSync("ffmpeg", ["-hide_banner", "-i", path.join(V, "audio/sfx.wav"), "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" }).stderr.match(/max_volume: ([-\d.]+) dB/) || [0, -8])[1];
  const sGain = db(-11 - sPeak);
  // 場面ごとの音楽の上げ下げ（題字・「行く」・完了・終わりは前へ。説明が続く所は控えめに）
  // 抑揚を大きく: 数字の所は引いて、題字で開く／「行く」と完了で山／つながりの章は明るく／決まりで引いて、一言と終わりで開く（11/11）
  const env = [[0, 1.1], [T("quiet"), 0.95], [T("numbers"), 0.7], [T("spark"), 0.85], [L("c13") - 0.4, 1.1], [L("c13"), 1.5], [T("ask"), 0.95], [C.goTap - 0.2, 0.95], [C.goTap, 1.4], [T("map") + 1.5, 1.05], [C.clear - 0.1, 1.0], [C.clear, 1.45], [T("card") + 1, 1.05], [T("chat"), 0.95], [T("nakama"), 1.0], [L("c53"), 1.25], [L("c26"), 1.0], [T("blank"), 1.5], [E("blank"), 1.5], [T("maker") + 0.5, 0.8], [L("c32") - 0.2, 0.8], [L("c32"), 1.05], [T("rules"), 0.7], [L("c37") - 0.3, 1.0], [L("c37"), 1.5], [T("huddle"), 1.3], [T("firstsnow"), 1.0], [T("gov"), 1.15], [T("end") - 0.2, 1.2], [T("end"), 1.55], [sec - 1.5, 1.5], [sec - 0.05, 0]];
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
  const m = lufs(raw);
  ff(["-i", raw, "-af", `loudnorm=I=-14:TP=-1.5:LRA=11:linear=true:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}`, "-ar", "48000", "-ac", "2", path.join(V, "mix.wav")]);
  const f = lufs(path.join(V, "mix.wav"));
  console.log(`声 ${vI} LUFS ／ 音楽 ${mI} ／ 効果音の山 ${sPeak} dB → 仕上げ ${f.input_i} LUFS（山 ${f.input_tp} dBTP）`);
}
function mux(out = OUT_DEFAULT) {
  ff(["-framerate", String(TL.fps), "-i", path.join(V, "out/%05d.jpg"), "-i", path.join(V, "mix.wav"), "-t", String(TL.seconds), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21", "-preset", "slow", "-profile:v", "high", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", out]);
  console.log("できた:", out, spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration,size", "-of", "csv=p=0", out], { encoding: "utf8" }).stdout.trim());
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
