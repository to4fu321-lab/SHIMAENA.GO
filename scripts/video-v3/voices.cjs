// 仮の声（合成音声）の設定。本人の声で録るまでの代わり（narrate.cjs）。
// 合成の道具: 手元で動く Style-Bert-VITS2（scripts/video-v3/tts/README.md）。声のモデルは Aivis のモデルハブで公開されているもの。
const path = require("path");
module.exports = {
  ttsDir: path.join(__dirname, "tts"),
  // 本人の文を読む声。落ち着いた語り
  narr: { model: "morioki", style: "ノーマル", speed: 1.14, seed: 0 },
  // 声のありがとう（孫の役）。動画では合成で代える。本番のアプリでは、家の人が自分の声で吹き込む
  grand: { model: "mai", style: "ノーマル", speed: 1.12, seed: 0, post: "highpass=f=180,lowpass=f=6500" },
  // 行ごとの上書き。seed = 別のテイク（同じ文でも言い方が少し変わる）。音声認識で聞き取りにくかった行は、聞き取れたテイクにした
  lines: { n36: { seed: 1 }, n42: { seed: 3 }, n44: { seed: 1 } },
  // 動画の最後に出すクレジット（本人の声に差し替えたら、ここを直す）
  credits: "音楽・効果音: アプリと同じ Web Audio の合成（音ファイルなし） ／ ナレーション: 合成音声（AivisSpeech モデル「morioki」）・孫の声: 合成音声（同「まい」）",
  // 声のありがとうの場面の下に出す注（本物の声に差し替えたら "" にする）
  voiceNote: "※ この動画の声は合成音声です。アプリでは、家の人が自分の声で吹き込みます（AI は書きません）。",
};
