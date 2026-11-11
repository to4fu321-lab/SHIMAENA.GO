// 隊長の声の設定。アプリの隊長と同じ声「雪降白華」（lib/speech/aivis.ts の既定）を、手元の合成の道具で鳴らす。
const SEEDS = { c02: 3, c13: 1, c15: 4, c26: 2, c29: 2, c33: 1, c36: 1, c40: 2, c52: 2 };
module.exports = {
  // 3分に収めるため、少し速め（手元の合成の道具での 1.3 倍）
  base: { model: "yukifuri", style: "ノーマル", speed: 1.3, seed: 0 },
  // 行ごとの上書き（seed = 別のテイク。あいさつと終わりは、少し元気に）
  // 行ごとの上書き。緩急: 静かな朝・ありがとう・終わりはゆっくり、アプリの画面は元気に速く。seed = 別のテイク
  lines: (() => {
    const o = { c01: { speed: 1.25, style_weight: 1.5 }, c45: { speed: 1.25, style_weight: 1.4 } };
    for (const id of ["c05", "c06", "c07"]) o[id] = { speed: 1.24 };
    for (const id of ["c14", "c15", "c17", "c18", "c20", "c22", "c24", "c51", "c52", "c53"]) o[id] = { speed: 1.35, style_weight: 1.25 };
    for (const id of ["c26", "c27", "c28"]) o[id] = { speed: 1.21 };
    for (const id of ["c40", "c41", "c42", "c43"]) o[id] = { speed: 1.15 };
    o.c37 = { speed: 1.1 };
    // 音声認識（scripts/video-v3/tts/asr.py）で聞き取りにくかった行は、聞き取れたテイクにした
    const seeds = SEEDS;
    for (const [id, seed] of Object.entries(seeds)) o[id] = { ...(o[id] || {}), seed };
    return o;
  })(),

  // クレジット（Tαkoe プロジェクトの声は著作権表示が必須: 「Tαkoe:ソフト名:キャラクター名」）
  credit: "Tαkoe:AivisSpeech:雪降白華",
};
