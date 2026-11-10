// 隊長の声の設定。アプリの隊長と同じ声「雪降白華」（lib/speech/aivis.ts の既定）を、手元の合成の道具で鳴らす。
module.exports = {
  // 3分に収めるため、少し速め（手元の合成の道具での 1.3 倍）
  base: { model: "yukifuri", style: "ノーマル", speed: 1.3, seed: 0 },
  // 行ごとの上書き（seed = 別のテイク。あいさつと終わりは、少し元気に）
  lines: {
    c01: { speed: 1.25, style_weight: 1.4 }, c45: { speed: 1.25, style_weight: 1.3 },
    // 音声認識（scripts/video-v3/tts/asr.py）で聞き取りにくかった行は、聞き取れたテイクにした（語頭の「ぼく」「点数」が弱くなりやすい）
    c02: { seed: 3 }, c13: { seed: 1 }, c17: { seed: 3 }, c18: { seed: 1 }, c24: { seed: 1 }, c26: { seed: 1 }, c27: { seed: 1 }, c33: { seed: 1 }, c36: { seed: 1 },
    // 「AI は、段取りを。人は、会いに行く。」は、ゆっくり
    c37: { speed: 1.1 },
  },
  // クレジット（Tαkoe プロジェクトの声は著作権表示が必須: 「Tαkoe:ソフト名:キャラクター名」）
  credit: "Tαkoe:AivisSpeech:雪降白華",
};
