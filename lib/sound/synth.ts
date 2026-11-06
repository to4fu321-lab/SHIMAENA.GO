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
    if (d) osc.detune.setValueAtTime(d, o.at);
    osc.connect(g);
    osc.start(o.at);
    osc.stop(o.at + o.dur + 0.05);
  }
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
export function bell(ctx: BaseAudioContext, out: AudioNode, midi: number, at: number, dur = 1.2, gain = 0.25): void {
  const f = hz(midi);
  tone(ctx, out, { f, at, dur, type: "sine", gain, attack: 0.002 });
  tone(ctx, out, { f: f * 3, at, dur: dur * 0.35, type: "sine", gain: gain * 0.25, attack: 0.002 });
  tone(ctx, out, { f: f * 5.2, at, dur: dur * 0.15, type: "sine", gain: gain * 0.08, attack: 0.001 });
}

/** エレピ風: 正弦波＋2倍音、短い立ち上がり、中くらいの減衰 */
export function epiano(ctx: BaseAudioContext, out: AudioNode, midi: number, at: number, dur = 0.8, gain = 0.2): void {
  const f = hz(midi);
  tone(ctx, out, { f, at, dur, type: "sine", gain, attack: 0.006 });
  tone(ctx, out, { f: f * 2, at, dur: dur * 0.6, type: "sine", gain: gain * 0.3, attack: 0.004 });
  tone(ctx, out, { f: f * 4.01, at, dur: dur * 0.2, type: "triangle", gain: gain * 0.06, attack: 0.002 });
}

/** 三角波ベース */
export function bass(ctx: BaseAudioContext, out: AudioNode, midi: number, at: number, dur = 0.4, gain = 0.3): void {
  tone(ctx, out, { f: hz(midi), at, dur, type: "triangle", gain, attack: 0.008, decay: "lin" });
}

/** 矩形波リード（2本ずらして厚く） */
export function lead(ctx: BaseAudioContext, out: AudioNode, midi: number, at: number, dur = 0.3, gain = 0.08): void {
  tone(ctx, out, { f: hz(midi), at, dur, type: "square", gain, attack: 0.01, decay: "lin", detune: 6 });
}

/** キック: 正弦波のピッチ落ち */
export function kick(ctx: BaseAudioContext, out: AudioNode, at: number, gain = 0.5): void {
  tone(ctx, out, { f: 150, f1: 45, at, dur: 0.22, type: "sine", gain, attack: 0.002 });
}

/** スネア（ブラシ風）: ノイズ＋ハイパス */
export function snare(ctx: BaseAudioContext, out: AudioNode, at: number, gain = 0.18): void {
  noise(ctx, out, { at, dur: 0.16, gain, filter: { type: "highpass", f: 1800 } });
  tone(ctx, out, { f: 190, f1: 120, at, dur: 0.1, type: "triangle", gain: gain * 0.6 });
}

/** 雪を踏む「ザッ」: 低めのノイズ */
export function crunch(ctx: BaseAudioContext, out: AudioNode, at: number, gain = 0.2): void {
  noise(ctx, out, { at, dur: 0.12, gain, filter: { type: "bandpass", f: 900, q: 0.7 } });
}

/** ハット: ごく短いノイズ */
export function hat(ctx: BaseAudioContext, out: AudioNode, at: number, gain = 0.06, dur = 0.04): void {
  noise(ctx, out, { at, dur, gain, filter: { type: "highpass", f: 7000 } });
}

/** クラップ: ノイズ3連 */
export function clap(ctx: BaseAudioContext, out: AudioNode, at: number, gain = 0.15): void {
  for (const d of [0, 0.012, 0.026]) noise(ctx, out, { at: at + d, dur: d === 0.026 ? 0.14 : 0.03, gain, filter: { type: "bandpass", f: 1600, q: 1.2 } });
}

/** パッド: 鋸波2本をずらしてローパス。ゆっくり出てゆっくり消える */
export function pad(ctx: BaseAudioContext, out: AudioNode, midis: number[], at: number, dur: number, gain = 0.05, cutoff = 900): void {
  const fl = ctx.createBiquadFilter();
  fl.type = "lowpass";
  fl.frequency.value = cutoff;
  fl.connect(out);
  for (const m of midis) tone(ctx, fl, { f: hz(m), at, dur, type: "sawtooth", gain, attack: Math.min(0.4, dur * 0.3), decay: "lin", detune: 7 });
}

/** 雪の風「しんしん」: ノイズをローパスで。ゆっくり */
export function wind(ctx: BaseAudioContext, out: AudioNode, at: number, dur: number, gain = 0.03): void {
  noise(ctx, out, { at, dur, gain, attack: Math.min(1.5, dur * 0.4), decay: "lin", filter: { type: "lowpass", f: 500, f1: 320, q: 0.5 } });
}
