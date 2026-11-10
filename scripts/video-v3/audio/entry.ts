// 動画の音楽と効果音を、アプリと同じ楽器（lib/sound）で作る。音ファイルは使わない。
// render-audio.cjs が esbuild でまとめて、ヘッドレスのブラウザの OfflineAudioContext で書き出す。
import { SONGS } from "../../../lib/sound/bgm";
import { SFX, type SfxName } from "../../../lib/sound/sfx";
import { createSpace } from "../../../lib/sound/space";
import { air, bass, bell, crash, epiano, glass, pad, riser, spread, wind } from "../../../lib/sound/synth";

type SongName = "morning" | "mission" | "clear";
export interface Cue {
  kind: "song" | "prelude" | "fanfare" | "warm" | "ending" | "riser" | "swell";
  at: number;
  /** song: 曲と、鳴らす小節の番号（順に並べる） */
  song?: SongName;
  bars?: number[];
  intro?: boolean;
  /** 音量（1 = アプリと同じ） */
  gain?: number;
  fadeIn?: number;
  /** 終わりを fadeOut 秒かけて消す（最後の小節の中で） */
  fadeOut?: number;
  /** この秒で止める（その前の untilFade 秒で消していく。既定 0.4）。曲の途中で次の曲に渡すとき */
  until?: number;
  untilFade?: number;
  /** prelude: 小節数。ending: 長さ（秒）。riser: 長さ */
  n?: number;
  dur?: number;
}
export interface Plan { seconds: number; sampleRate: number; music: Cue[]; sfx: { name: SfxName; at: number; gain?: number }[]; }

// 決まった乱数（何度作っても同じ音になる。楽器の「人が弾いたゆらぎ」は Math.random を使う）
function seed(n: number) { let a = n >>> 0; Math.random = () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** 曲の長さ（秒） */
export function cueSeconds(c: Cue): number {
  if (c.kind === "song") { const s = SONGS[c.song!]; return (c.intro && s.intro ? 1.2 : 0) + (60 / s.bpm) * 4 * c.bars!.length; }
  if (c.kind === "prelude") return (60 / PRELUDE_BPM) * 4 * (c.n ?? 8);
  return c.dur ?? 4;
}

// 冒頭（課題の章）: しらかばの朝と同じ D の調で、Bm7 → Gmaj7 → D/F# → A7sus4。ビートなし。風とエレピだけ。静かで、少しさびしい。
const PRELUDE_BPM = 66;
const PRE_CHORDS = [
  [59, 62, 66, 69], // Bm7
  [55, 59, 62, 66], // Gmaj7
  [54, 57, 62, 66], // D/F#
  [57, 62, 64, 67], // A7sus4
];
const PRE_BASS = [47, 43, 42, 45]; // 1オクターブ上（スマホのスピーカーでも聞こえ、低音がこもらない）
// ぽつりぽつりと置く旋律（D メジャーのペンタトニック）。[小節(0-3), 拍, MIDI, 長さ(拍)]
const PRE_MEL: [number, number, number, number][] = [
  [0, 2, 78, 2], [1, 0, 74, 1.5], [1, 2.5, 76, 1.5], [2, 1, 81, 2], [2, 3, 78, 1], [3, 0.5, 76, 3],
];
function prelude(ctx: BaseAudioContext, out: AudioNode, at: number, n: number) {
  const beat = 60 / PRELUDE_BPM;
  wind(ctx, out, at, beat * 4 * n + 2, 0.03);
  for (let b = 0; b < n; b++) {
    const t0 = at + b * beat * 4, a = b % 4, chord = PRE_CHORDS[a];
    air(ctx, out, chord, t0, beat * 4.4, 0.016);
    // エレピ: 1拍目に和音をそっと、あとは分散で1音ずつ
    chord.forEach((m, i) => epiano(ctx, out, m, t0 + i * 0.035, beat * 3.6, 0.05, spread(m)));
    epiano(ctx, out, chord[2] + 12, t0 + beat * 1.5, beat * 2, 0.035, spread(chord[2] + 12));
    epiano(ctx, out, chord[1] + 12, t0 + beat * 3, beat * 1.4, 0.03, spread(chord[1] + 12));
    bass(ctx, out, PRE_BASS[a], t0, beat * 3.4, 0.085);
    if (b >= 2) for (const [bar, x, m, d] of PRE_MEL) if (bar === a) bell(ctx, out, m, t0 + x * beat, beat * d * 1.5, 0.06, spread(m));
  }
}
// 題字: D の鈴が上がる（しらかばの朝の頭につながる）
function fanfare(ctx: BaseAudioContext, out: AudioNode, at: number) {
  [74, 78, 81, 86].forEach((m, i) => bell(ctx, out, m, at + i * 0.13, 1.6, 0.15, spread(m)));
  for (const m of [62, 66, 69, 73]) epiano(ctx, out, m, at + 0.4, 1.6, 0.09, spread(m));
  for (let i = 0; i < 6; i++) glass(ctx, out, 93 + [0, 4, 7][i % 3], at + 0.55 + i * 0.07, 0.6, 0.035, spread(93));
  bass(ctx, out, 38, at + 0.4, 1.4, 0.16);
}
// 「AI は段取りを。人は、会いに行く。」: C の和音をひとつ、あたたかく
function warm(ctx: BaseAudioContext, out: AudioNode, at: number, dur: number) {
  const chord = [60, 64, 67, 71];
  air(ctx, out, chord, at, dur, 0.02);
  chord.forEach((m, i) => epiano(ctx, out, m, at + i * 0.06, dur * 0.9, 0.075, spread(m)));
  bass(ctx, out, 36, at, dur * 0.8, 0.16);
  bell(ctx, out, 79, at + dur * 0.45, 1.6, 0.07, 0.2);
  bell(ctx, out, 84, at + dur * 0.45 + 0.16, 2.0, 0.07, -0.2);
}
// おわり: C の和音がゆっくりほどけて、鈴がひとつ
function ending(ctx: BaseAudioContext, out: AudioNode, at: number, dur: number) {
  const chord = [48, 60, 64, 67, 71, 76];
  pad(ctx, out, [60, 64, 67, 72], at, dur, 0.022, 1400);
  air(ctx, out, [60, 64, 67, 71], at, dur, 0.02);
  chord.forEach((m, i) => epiano(ctx, out, m, at + i * 0.09, dur * 0.85, 0.07, spread(m)));
  bass(ctx, out, 36, at, dur * 0.7, 0.2);
  [79, 84, 88].forEach((m, i) => bell(ctx, out, m, at + 0.9 + i * 0.22, 2.4, 0.08, spread(m)));
  bell(ctx, out, 96, at + 2.2, 2.6, 0.05, 0);
}

function wav(buf: AudioBuffer): string {
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const pcm = new Int16Array(L.length * 2);
  for (let i = 0; i < L.length; i++) { pcm[2 * i] = Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))); pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))); }
  const u8 = new Uint8Array(pcm.buffer);
  let bin = "";
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000) as unknown as number[]);
  return btoa(bin);
}
const peakOf = (b: AudioBuffer) => { let m = 0; for (let c = 0; c < b.numberOfChannels; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > m) m = v; } } return m; };

/**
 * 音楽を1曲ぶんだけ書き出す（c.at を 0 として、長さ＋余韻ぶん）。
 * 3分を1本で書き出すと、曲の数だけ残響（コンボルバー）が3分ずっと回って遅いので、曲ごとに分けて Node 側で重ねる。
 */
async function renderCue(c: Cue, sampleRate: number, index: number) {
  seed(20261108 + index * 7919);
  const len = cueSeconds(c), tail = 5.5, pre = 0.05;
  const ctx = new OfflineAudioContext(2, Math.ceil((pre + len + tail) * sampleRate), sampleRate);
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  // 響き（やまびこ・残響・コンプレッサー）。やまびこの間隔は曲のテンポに合わせる
  const space = createSpace(ctx, master);
  const g = ctx.createGain();
  const level = 0.55 * (c.gain ?? 1);
  const at = pre;
  g.gain.setValueAtTime(c.fadeIn ? 0.0001 : level, 0);
  if (c.fadeIn) g.gain.linearRampToValueAtTime(level, at + c.fadeIn);
  if (c.fadeOut) { g.gain.setValueAtTime(level, at + len - c.fadeOut); g.gain.linearRampToValueAtTime(0.0001, at + len); }
  if (c.until != null) { const u = at + (c.until - c.at), f = c.untilFade ?? 0.4; g.gain.setValueAtTime(level, Math.max(at + (c.fadeIn ?? 0), u - f)); g.gain.linearRampToValueAtTime(0.0001, u); }
  g.connect(space.input);
  if (c.kind === "song") {
    const s = SONGS[c.song!];
    space.setTempo(s.bpm);
    const beat = 60 / s.bpm;
    let t = at;
    if (c.intro && s.intro) t += s.intro(ctx, g, t);
    c.bars!.forEach((b, i) => s.bar(ctx, g, b, t + i * beat * 4, beat));
  } else if (c.kind === "prelude") { space.setTempo(PRELUDE_BPM); prelude(ctx, g, at, c.n ?? 8); }
  else if (c.kind === "fanfare") fanfare(ctx, g, at);
  else if (c.kind === "warm") warm(ctx, g, at, c.dur ?? 4);
  else if (c.kind === "ending") ending(ctx, g, at, c.dur ?? 6);
  else if (c.kind === "riser") { riser(ctx, g, at, c.dur ?? 1.5, 0.07); crash(ctx, g, at + (c.dur ?? 1.5), 0.06); }
  else if (c.kind === "swell") { air(ctx, g, [62, 66, 69, 74], at, c.dur ?? 4, 0.03); wind(ctx, g, at, c.dur ?? 4, 0.04); }
  const buf = await ctx.startRendering();
  return { b64: wav(buf), peak: peakOf(buf), offset: c.at - pre };
}
/** 効果音だけ（アプリのボタンや知らせの音） */
async function renderSfx(plan: Plan) {
  seed(7);
  const ctx = new OfflineAudioContext(2, Math.ceil(plan.seconds * plan.sampleRate), plan.sampleRate);
  const master = ctx.createGain();
  master.gain.value = 0.8;
  master.connect(ctx.destination);
  for (const s of plan.sfx) {
    const fn = SFX[s.name];
    if (!fn) continue;
    const g = ctx.createGain();
    g.gain.value = s.gain ?? 1;
    g.connect(master);
    fn(ctx, g, Math.max(0, s.at));
  }
  const buf = await ctx.startRendering();
  return { b64: wav(buf), peak: peakOf(buf) };
}

(window as unknown as Record<string, unknown>).renderCue = renderCue;
(window as unknown as Record<string, unknown>).renderSfx = renderSfx;
(window as unknown as Record<string, unknown>).songInfo = () => Object.fromEntries(Object.entries(SONGS).map(([k, s]) => [k, { bpm: s.bpm, bars: s.bars, bar: (60 / s.bpm) * 4 }]));
(window as unknown as Record<string, unknown>).preludeBar = (60 / PRELUDE_BPM) * 4;
