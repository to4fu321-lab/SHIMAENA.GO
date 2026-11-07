// 音を作る部品（Web Audio）。音ファイルは使わず、全部ここで合成する（spec v1.19）。
// 効果音も BGM の楽器も、この小さな関数の組み合わせ。

export type Wave = OscillatorType;

/** MIDI 番号 → Hz（69 = A4 = 440Hz） */
export const hz = (midi: number): number => 440 * 2 ** ((midi - 69) / 12);

export interface ToneOpts {
  /** 始まりの Hz（または MIDI 番号を hz() で） */
  f: number;
  /** 終わりの Hz（あれば指数で滑らせる） */
  f1?: number;
  at: number;
  dur: number;
  type?: Wave;
  gain?: number;
  /** 立ち上がり（秒） */
  attack?: number;
  /** 減衰の形: "exp" は打楽器・鈴らしく、"lin" はなだらか */
  decay?: "exp" | "lin";
  /** 少しずらした2本目（セント）。シンセらしい厚み */
  detune?: number;
  /** 全体を少しずらす（セント）。左右で違うずれを付けるときに */
  cents?: number;
  /** ビブラート: after 秒たってから、hz の速さで ±cents 揺らす（歌うリード） */
  vibrato?: { hz: number; cents: number; after?: number };
}

/** 1音。減衰して消える */
export function tone(ctx: BaseAudioContext, out: AudioNode, o: ToneOpts): void {
  const g = ctx.createGain();
  const peak = Math.max(0.0001, o.gain ?? 0.3);
  const a = o.attack ?? 0.005;
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.linearRampToValueAtTime(peak, o.at + a);
  if (o.decay === "lin") g.gain.linearRampToValueAtTime(0.0001, o.at + o.dur);
  else g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  g.connect(out);
  const voices = o.detune ? [-o.detune, o.detune] : [0];
  for (const d of voices) {
    const osc = ctx.createOscillator();
    osc.type = o.type ?? "sine";
    osc.frequency.setValueAtTime(o.f, o.at);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), o.at + o.dur);
    if (d || o.cents) osc.detune.setValueAtTime(d + (o.cents ?? 0), o.at);
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = o.vibrato.hz;
      const depth = ctx.createGain();
      const after = o.at + (o.vibrato.after ?? 0.12);
      depth.gain.setValueAtTime(0, o.at);
      depth.gain.linearRampToValueAtTime(o.vibrato.cents, after + 0.15);
      lfo.connect(depth);
      depth.connect(osc.detune);
      lfo.start(o.at);
      lfo.stop(o.at + o.dur + 0.05);
    }
    osc.connect(g);
    osc.start(o.at);
    osc.stop(o.at + o.dur + 0.05);
  }
}

/** 左右に置く（-1 左 … 1 右）。0 や対応しない端末ではそのまま */
export function pan(ctx: BaseAudioContext, out: AudioNode, p = 0): AudioNode {
  if (!p || typeof (ctx as { createStereoPanner?: unknown }).createStereoPanner !== "function") return out;
  const n = ctx.createStereoPanner();
  n.pan.value = Math.max(-1, Math.min(1, p));
  n.connect(out);
  return n;
}

/** 音の高さで左右に散らす（低い音は左、高い音は右。ピアノの前に座ったときの並び） */
export const spread = (midi: number, width = 0.45): number => Math.max(-width, Math.min(width, ((midi - 67) / 30) * width));

export interface FmOpts {
  f: number;
  at: number;
  dur: number;
  gain?: number;
  attack?: number;
  /** 変調する音の高さの比（1 = 同じ高さ → 倍音がきれいに並ぶ。14 = 打鍵の金属音） */
  ratio: number;
  /** 変調の深さ（始まり）。f の何倍まで揺らすか */
  index: number;
  /** 変調の深さ（終わり）。鳴りながら丸くなる */
  indexEnd?: number;
  /** 深さが落ちるまでの秒 */
  indexDecay?: number;
}

/** FM 合成（2オペレータ）: 正弦波の高さを別の正弦波で揺らすと、倍音が生まれて「楽器」になる。エレピ・ベルの本体 */
export function fm(ctx: BaseAudioContext, out: AudioNode, o: FmOpts): void {
  const g = ctx.createGain();
  const peak = Math.max(0.0001, o.gain ?? 0.3);
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.linearRampToValueAtTime(peak, o.at + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  g.connect(out);
  const car = ctx.createOscillator();
  car.type = "sine";
  car.frequency.setValueAtTime(o.f, o.at);
  const mod = ctx.createOscillator();
  mod.type = "sine";
  mod.frequency.setValueAtTime(o.f * o.ratio, o.at);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(Math.max(0.01, o.index * o.f), o.at);
  depth.gain.exponentialRampToValueAtTime(Math.max(0.01, (o.indexEnd ?? 0.1) * o.f), o.at + (o.indexDecay ?? o.dur * 0.5));
  mod.connect(depth);
  depth.connect(car.frequency);
  car.connect(g);
  car.start(o.at);
  mod.start(o.at);
  car.stop(o.at + o.dur + 0.05);
  mod.stop(o.at + o.dur + 0.05);
}

const noiseBuffers = new WeakMap<BaseAudioContext, AudioBuffer>();
/** 1秒のホワイトノイズ（ctx ごとに1回だけ作る） */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseBuffers.get(ctx);
  if (b) return b;
  b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = b.getChannelData(0);
  let seed = 1234567;
  for (let i = 0; i < d.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0; // 毎回同じ「サー」（テストしやすい）
    d[i] = (seed / 4294967296) * 2 - 1;
  }
  noiseBuffers.set(ctx, b);
  return b;
}

export interface NoiseOpts {
  at: number;
  dur: number;
  gain?: number;
  attack?: number;
  decay?: "exp" | "lin";
  /** フィルタ: lowpass で「ザッ」「フワッ」、highpass で「シャッ」「カシャ」、bandpass で風 */
  filter?: { type: BiquadFilterType; f: number; f1?: number; q?: number };
}

/** ノイズの一吹き。打楽器・風・紙・スコップの音 */
export function noise(ctx: BaseAudioContext, out: AudioNode, o: NoiseOpts): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const g = ctx.createGain();
  const peak = Math.max(0.0001, o.gain ?? 0.2);
  const a = o.attack ?? 0.003;
  g.gain.setValueAtTime(0.0001, o.at);
  g.gain.linearRampToValueAtTime(peak, o.at + a);
  if (o.decay === "lin") g.gain.linearRampToValueAtTime(0.0001, o.at + o.dur);
  else g.gain.exponentialRampToValueAtTime(0.0001, o.at + o.dur);
  let head: AudioNode = src;
  if (o.filter) {
    const fl = ctx.createBiquadFilter();
    fl.type = o.filter.type;
    fl.frequency.setValueAtTime(o.filter.f, o.at);
    if (o.filter.f1) fl.frequency.exponentialRampToValueAtTime(Math.max(10, o.filter.f1), o.at + o.dur);
    fl.Q.value = o.filter.q ?? 1;
    src.connect(fl);
    head = fl;
  }
  head.connect(g);
  g.connect(out);
  src.start(o.at);
  src.stop(o.at + o.dur + 0.05);
}

/** 音の並び（メロディ・アルペジオ）。[MIDI, 始まり(秒), 長さ(秒)] */
export function notes(ctx: BaseAudioContext, out: AudioNode, at: number, seq: [number, number, number][], o: Omit<ToneOpts, "f" | "at" | "dur">): void {
  for (const [m, t, d] of seq) tone(ctx, out, { ...o, f: hz(m), at: at + t, dur: d });
}

/** 鈴・オルゴール: 正弦波＋高い倍音を速く減らす */
export function bell(ctx: BaseAudioContext, out: AudioNode, midi: number, at: number, dur = 1.2, gain = 0.25, p = 0): void {
  const f = hz(midi);
  out = pan(ctx, out, p);
  tone(ctx, out, { f, at, dur, type: "sine", gain, attack: 0.002 });
  tone(ctx, out, { f: f * 3, at, dur: dur * 0.35, type: "sine", gain: gain * 0.25, attack: 0.002 });
  tone(ctx, out, { f: f * 5.2, at, dur: dur * 0.15, type: "sine", gain: gain * 0.08, attack: 0.001 });
}

/** エレピ（ローズ風）: FM 合成。本体は比 1 で倍音がきれいに並び、鳴りながら丸くなる。打鍵の「コツッ」は比 14 の短い金属音。少しずれた2本目で揺れ */
export function epiano(ctx: BaseAudioContext, out: AudioNode, midi: number, at: number, dur = 0.8, gain = 0.2, p = 0): void {
  const f = hz(midi);
  out = pan(ctx, out, p);
  fm(ctx, out, { f, at, dur, gain: gain * 0.9, attack: 0.004, ratio: 1, index: 1.4, indexEnd: 0.12, indexDecay: Math.min(0.45, dur * 0.6) });
  fm(ctx, out, { f, at, dur: Math.min(dur, 0.22), gain: gain * 0.3, attack: 0.002, ratio: 14, index: 0.5, indexEnd: 0.03, indexDecay: 0.05 });
  tone(ctx, out, { f: f * 1.004, at: at + 0.012, dur: dur * 0.9, type: "sine", gain: gain * 0.22, attack: 0.02 });
}

/** ベース: 三角波の芯＋ローパスした鋸波（出だしだけ開いて閉じる＝「ドゥン」の丸さ） */
export function bass(ctx: BaseAudioContext, out: AudioNode, midi: number, at: number, dur = 0.4, gain = 0.3): void {
  const f = hz(midi);
  tone(ctx, out, { f, at, dur, type: "triangle", gain: gain * 0.75, attack: 0.008, decay: "lin" });
  const fl = ctx.createBiquadFilter();
  fl.type = "lowpass";
  fl.Q.value = 1.6;
  fl.frequency.setValueAtTime(Math.min(2400, f * 9), at);
  fl.frequency.exponentialRampToValueAtTime(Math.max(80, f * 2.2), at + Math.min(0.25, dur * 0.7));
  fl.connect(out);
  tone(ctx, fl, { f, at, dur, type: "sawtooth", gain: gain * 0.3, attack: 0.01, decay: "lin" });
}

/** 矩形波リード（2本ずらして厚く） */
export function lead(ctx: BaseAudioContext, out: AudioNode, midi: number, at: number, dur = 0.3, gain = 0.08, p = 0): void {
  out = pan(ctx, out, p);
  tone(ctx, out, { f: hz(midi), at, dur, type: "square", gain, attack: 0.01, decay: "lin", detune: 6, vibrato: { hz: 5.5, cents: 10, after: 0.15 } });
}

/** キック: 正弦波のピッチ落ち */
export function kick(ctx: BaseAudioContext, out: AudioNode, at: number, gain = 0.5): void {
  tone(ctx, out, { f: 160, f1: 42, at, dur: 0.26, type: "sine", gain, attack: 0.002 });
  noise(ctx, out, { at, dur: 0.012, gain: gain * 0.35, attack: 0.001, filter: { type: "highpass", f: 1500 } }); // 打点の「コッ」
}

/** スネア（ブラシ風）: ノイズ＋ハイパス */
export function snare(ctx: BaseAudioContext, out: AudioNode, at: number, gain = 0.18, p = 0): void {
  out = pan(ctx, out, p);
  noise(ctx, out, { at, dur: 0.16, gain, filter: { type: "highpass", f: 1800 } });
  tone(ctx, out, { f: 190, f1: 120, at, dur: 0.1, type: "triangle", gain: gain * 0.6 });
}

/** 雪を踏む「ザッ」: 低めのノイズ */
export function crunch(ctx: BaseAudioContext, out: AudioNode, at: number, gain = 0.2, p = 0): void {
  noise(ctx, pan(ctx, out, p), { at, dur: 0.12, gain, filter: { type: "bandpass", f: 900, q: 0.7 } });
}

/** ハット: ごく短いノイズ */
export function hat(ctx: BaseAudioContext, out: AudioNode, at: number, gain = 0.06, dur = 0.04, p = 0): void {
  noise(ctx, pan(ctx, out, p), { at, dur, gain, filter: { type: "highpass", f: 7000 } });
}

/** クラップ: ノイズ3連 */
export function clap(ctx: BaseAudioContext, out: AudioNode, at: number, gain = 0.15, p = 0): void {
  out = pan(ctx, out, p);
  for (const d of [0, 0.012, 0.026]) noise(ctx, out, { at: at + d, dur: d === 0.026 ? 0.14 : 0.03, gain, filter: { type: "bandpass", f: 1600, q: 1.2 } });
}

/** パッド: 鋸波を左右にずらして置き、ローパスがゆっくり開いたり閉じたりする（呼吸）。ゆっくり出てゆっくり消える */
export function pad(ctx: BaseAudioContext, out: AudioNode, midis: number[], at: number, dur: number, gain = 0.05, cutoff = 900): void {
  const fl = ctx.createBiquadFilter();
  fl.type = "lowpass";
  fl.frequency.value = cutoff;
  fl.Q.value = 0.7;
  fl.connect(out);
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.17;
  const breath = ctx.createGain();
  breath.gain.value = cutoff * 0.3;
  lfo.connect(breath);
  breath.connect(fl.frequency);
  lfo.start(at);
  lfo.stop(at + dur + 0.1);
  const L = pan(ctx, fl, -0.5);
  const R = pan(ctx, fl, 0.5);
  const attack = Math.min(0.4, dur * 0.3);
  for (const m of midis) {
    tone(ctx, L, { f: hz(m), at, dur, type: "sawtooth", gain: gain * 0.5, attack, decay: "lin", cents: -7 });
    tone(ctx, R, { f: hz(m), at, dur, type: "sawtooth", gain: gain * 0.5, attack, decay: "lin", cents: 7 });
  }
}

/** 雪の風「しんしん」: ノイズをローパスで。ゆっくり */
export function wind(ctx: BaseAudioContext, out: AudioNode, at: number, dur: number, gain = 0.03): void {
  noise(ctx, out, { at, dur, gain, attack: Math.min(1.5, dur * 0.4), decay: "lin", filter: { type: "lowpass", f: 500, f1: 320, q: 0.5 } });
}

/** レコードのパチパチ（lo-fi の質感）: 1小節ぶんに小さなノイズの粒をまばらに。粒は小節の中に収める */
export function crackle(ctx: BaseAudioContext, out: AudioNode, at: number, dur: number, gain = 0.02, perSecond = 3, p = 0): void {
  out = pan(ctx, out, p);
  const n = Math.max(1, Math.round(dur * perSecond));
  for (let i = 0; i < n; i++) {
    const t = at + Math.random() * dur * 0.97;
    noise(ctx, out, { at: t, dur: 0.003 + Math.random() * 0.006, gain: gain * (0.3 + Math.random()), attack: 0.001, filter: { type: "bandpass", f: 2600 + Math.random() * 1500, q: 0.8 } });
  }
}
