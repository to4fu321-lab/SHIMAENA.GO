// BGM の「響き」（spec v1.37）。音ファイルなし。
// - やまびこ（ディレイ）: 曲のテンポに合わせた付点8分で、少しずつ暗くなりながら返る
// - 残響（リバーブ）: 減衰するノイズから 2.4 秒の「雪の朝の部屋」を作って畳み込む（ConvolverNode）
// - 軽いコンプレッサー: 響きを足しても山が出ないように
// 乾いた音（dry）はそのまま、響きは別の道で薄く足す（send/return）。

const irCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** 残響の素（インパルス応答）。左右で違うノイズ、指数で減衰、高い音は先に消える */
export function reverbImpulse(ctx: BaseAudioContext, seconds = 2.8, preDelay = 0.02): AudioBuffer {
  const cached = irCache.get(ctx);
  if (cached) return cached;
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  const pre = Math.floor(sr * preDelay);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let seed = ch ? 987654321 : 192837465;
    let lp = 0; // 1次ローパス（時間がたつほど効かせる＝高音から消える）
    for (let i = pre; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const white = (seed / 4294967296) * 2 - 1;
      const t = (i - pre) / sr;
      const k = 0.2 + 0.5 * Math.min(1, t / seconds); // 進むほど丸く（始まりは明るく＝透明感）
      lp += (white - lp) * (1 - k);
      d[i] = lp * Math.exp((-6.5 * t) / seconds); // 終わりで -56dB くらい
    }
  }
  irCache.set(ctx, buf);
  return buf;
}

/** やわらかい歪みの曲線: 小さい音はそのまま（傾き 1）、大きい音ほど丸める（tanh） */
export function softCurve(k = 1.7, n = 1024): Float32Array<ArrayBuffer> {
  const c = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = Math.tanh(k * x) / k;
  }
  return c;
}

export interface Space {
  /** ここへつなぐ（BGM の音量ノードの出口） */
  input: GainNode;
  /** 曲のテンポに合わせて、やまびこの間隔を付点8分にする */
  setTempo(bpm: number): void;
}

/** BGM 用の響きを組む。input → dry／delay／reverb → compressor → out */
export function createSpace(ctx: BaseAudioContext, out: AudioNode): Space {
  const input = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -22;
  comp.knee.value = 14;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.25;
  comp.connect(out);

  // 乾いた音: やわらかい歪み（テープ風。山だけ少し丸める）→ 高音を少し落とす（lo-fi の温かさ）→ コンプレッサー
  const warm = ctx.createWaveShaper();
  warm.curve = softCurve(1.7);
  warm.oversample = "2x";
  const shelf = ctx.createBiquadFilter();
  shelf.type = "highshelf";
  shelf.frequency.value = 9000;
  shelf.gain.value = -1.5;
  input.connect(warm);
  warm.connect(shelf);
  shelf.connect(comp);

  // やまびこ: send → delay ⇄ (feedback → lowpass) → return
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.33;
  const dlySend = ctx.createGain();
  dlySend.gain.value = 0.16;
  const fb = ctx.createGain();
  fb.gain.value = 0.32;
  const fbLp = ctx.createBiquadFilter();
  fbLp.type = "lowpass";
  fbLp.frequency.value = 2200;
  const dlyReturn = ctx.createGain();
  dlyReturn.gain.value = 0.8;
  input.connect(dlySend);
  dlySend.connect(delay);
  delay.connect(fbLp);
  fbLp.connect(fb);
  fb.connect(delay);
  delay.connect(dlyReturn);
  dlyReturn.connect(comp);

  // 残響: send → highpass（低音はにごるので削る）→ convolver → return
  const revSend = ctx.createGain();
  revSend.gain.value = 0.3;
  const revHp = ctx.createBiquadFilter();
  revHp.type = "highpass";
  revHp.frequency.value = 320; // 低音はにごるので削る（透明感）
  const conv = ctx.createConvolver();
  try {
    conv.buffer = reverbImpulse(ctx);
  } catch {
    /* 作れない端末では乾いた音だけ */
  }
  const revReturn = ctx.createGain();
  revReturn.gain.value = 0.7;
  input.connect(revSend);
  revSend.connect(revHp);
  revHp.connect(conv);
  conv.connect(revReturn);
  revReturn.connect(comp);
  // やまびこにも少し残響をかける（返ってくる音が遠く聞こえる）
  dlyReturn.connect(revHp);

  return {
    input,
    setTempo(bpm: number) {
      const t = Math.min(1.4, Math.max(0.1, (60 / bpm) * 0.75));
      delay.delayTime.setTargetAtTime(t, ctx.currentTime, 0.2);
    },
  };
}
