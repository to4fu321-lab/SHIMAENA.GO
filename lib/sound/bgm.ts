"use client";
// BGM（spec v1.19）: 3曲を音符データで作曲し、Web Audio で鳴らす。音ファイルなし。
// 「しらかばの朝」lo-fi chill（82bpm・D）／「出撃！」citypop drive（120bpm・F）／「灯りがともる」warm celebration（100bpm・C）。
// v1.37: どの曲も 16 小節（前半 A・後半 B で展開）。後半に入ると編成が変わって、同じ繰り返しに聞こえない。
// 鳴らし方は Web Audio の定番「2つの時計」: setInterval（25ms）で、少し先（0.15秒）までの小節を予約していく。
// 曲の切りかえは 0.6 秒のクロスフェード。同じ曲ならタブを移っても頭に戻らない。
import { getEngine, isUnlocked, onRebuild, onSoundPrefs, onUnlocked, setBgmLevel, setBgmTempo, soundPrefs } from "./engine";
import { bass, bell, clap, crackle, crunch, epiano, hat, kick, lead, pad, snare, wind } from "./synth";
import type { SnowSong } from "./snow-song";

/** v1.28: snow = 今朝の雪の歌（その日だけの曲。なければ「しらかばの朝」） */
export type BgmTrack = "morning" | "mission" | "clear" | "snow";
type FixedTrack = Exclude<BgmTrack, "snow">;

/** 1小節ぶんを予約する関数。b = 小節の番号（0〜bars-1）、t0 = 小節の始まり（秒）、beat = 1拍の秒 */
type BarFn = (ctx: BaseAudioContext, out: AudioNode, b: number, t0: number, beat: number) => void;

export interface Song {
  title: string;
  bpm: number;
  bars: number;
  /** 最初に1回だけ（ファンファーレなど）。返り値は長さ（秒） */
  intro?: (ctx: BaseAudioContext, out: AudioNode, at: number) => number;
  bar: BarFn;
}

// ---- 人が弾いたようなゆらぎ（v1.37）----
/** 時刻を 0〜ms だけ遅らせる（前には出さない: 小節の頭より前に予約しない） */
const lag = (t: number, ms = 14): number => t + (Math.random() * ms) / 1000;
/** 音量を ±w だけ揺らす */
const vel = (g: number, w = 0.12): number => g * (1 - w + Math.random() * 2 * w);

// ---- 音符データ（MIDI 番号。60 = C4）----
// しらかばの朝: Dmaj7 - Bm7 - Gmaj7 - A7sus4→A7（2小節ずつ）
const MORNING_CHORDS = [
  [62, 66, 69, 73], // Dmaj7
  [59, 62, 66, 69], // Bm7
  [55, 59, 62, 66], // Gmaj7
  [57, 62, 64, 67], // A7sus4
  [57, 61, 64, 67], // A7
];
const MORNING_BASS = [38, 35, 31, 33]; // D2 B1 G1 A1
/** 鈴の合いの手（D メジャーのペンタトニック）。[小節, 拍, MIDI, 長さ(拍)] */
const MORNING_BELLS: [number, number, number, number][] = [
  [3, 2.5, 78, 0.5],
  [3, 3, 81, 0.5],
  [3, 3.5, 86, 1],
  [7, 2, 86, 0.5],
  [7, 2.5, 83, 0.5],
  [7, 3, 81, 0.5],
  [7, 3.5, 78, 1.5],
];
/** 後半（9〜16小節目）のメロディ（D ペンタトニック）。9〜12 はエレピでしっとり、13〜16 は鈴で */
const MORNING_MELODY_B: [number, number, number, number][] = [
  [8, 0, 78, 1], [8, 1, 81, 0.5], [8, 1.5, 83, 1.5], [8, 3, 81, 1],
  [9, 0, 78, 1.5], [9, 1.5, 76, 0.5], [9, 2, 74, 2],
  [10, 0, 76, 1], [10, 1, 78, 0.5], [10, 1.5, 81, 1.5], [10, 3, 83, 1],
  [11, 0, 81, 1.5], [11, 1.5, 78, 0.5], [11, 2, 76, 1], [11, 3, 74, 1],
  [12, 0, 86, 1], [12, 1, 83, 0.5], [12, 1.5, 81, 1.5], [12, 3, 83, 1],
  [13, 0, 81, 1.5], [13, 1.5, 78, 0.5], [13, 2, 76, 1], [13, 3, 78, 1],
  [14, 0, 74, 1], [14, 1, 76, 0.5], [14, 1.5, 78, 1.5], [14, 3, 81, 1],
  [15, 0, 78, 2], [15, 2, 76, 1], [15, 3, 74, 1],
];

// 出撃！: Fmaj7 - G7 - Em7 - Am7 - Bbmaj7 - C - Fmaj7 - C（1小節ずつ）
const MISSION_CHORDS = [
  [53, 57, 60, 64], // Fmaj7
  [55, 59, 62, 65], // G7
  [52, 55, 59, 62], // Em7
  [57, 60, 64, 67], // Am7
  [58, 62, 65, 69], // Bbmaj7
  [60, 64, 67, 72], // C
  [53, 57, 60, 64], // Fmaj7
  [60, 64, 67, 72], // C
];
const MISSION_BASS = [41, 43, 40, 45, 46, 48, 41, 48];
/** 矩形波リードのメロディ（4小節目から）。[小節, 拍, MIDI, 長さ(拍)] */
const MISSION_LEAD: [number, number, number, number][] = [
  [3, 2, 67, 0.5], [3, 2.5, 69, 0.5], [3, 3, 72, 0.5], [3, 3.5, 74, 0.5],
  [4, 0, 77, 1], [4, 1, 74, 0.5], [4, 1.5, 72, 0.5], [4, 2, 74, 1], [4, 3, 77, 1],
  [5, 0, 76, 1.5], [5, 1.5, 74, 0.5], [5, 2, 72, 1], [5, 3, 69, 1],
  [6, 0, 72, 0.5], [6, 0.5, 76, 0.5], [6, 1, 77, 0.5], [6, 1.5, 81, 1.5], [6, 3, 79, 1],
  [7, 0, 76, 1], [7, 1.5, 74, 0.5], [7, 2, 72, 0.5], [7, 2.5, 74, 0.5], [7, 3, 76, 1],
];
/** 後半（9〜16小節目）のサビ: リードが歌い続ける。最後は高く上がって頭へ */
const MISSION_LEAD_B: [number, number, number, number][] = [
  [8, 0, 77, 0.5], [8, 0.5, 77, 0.5], [8, 1, 76, 0.5], [8, 1.5, 77, 1], [8, 2.5, 81, 1.5],
  [9, 0, 79, 1], [9, 1, 77, 0.5], [9, 1.5, 76, 0.5], [9, 2, 74, 1], [9, 3, 71, 1],
  [10, 0, 72, 0.5], [10, 0.5, 74, 0.5], [10, 1, 76, 1], [10, 2, 79, 1], [10, 3, 76, 1],
  [11, 0, 77, 1.5], [11, 1.5, 76, 0.5], [11, 2, 74, 1], [11, 3, 72, 1],
  [12, 0, 74, 0.5], [12, 0.5, 77, 0.5], [12, 1, 81, 1], [12, 2, 79, 1], [12, 3, 77, 1],
  [13, 0, 79, 1.5], [13, 1.5, 76, 0.5], [13, 2, 72, 1], [13, 3, 74, 1],
  [14, 0, 76, 0.5], [14, 0.5, 77, 0.5], [14, 1, 81, 1.5], [14, 2.5, 79, 0.5], [14, 3, 77, 1],
  [15, 0, 79, 2], [15, 2, 81, 1], [15, 3, 84, 1],
];

// 灯りがともる: Cmaj7 - Em7 - Fmaj7 - G - Am7 - Fmaj7 - G - C（1小節ずつ）
const CLEAR_CHORDS = [
  [60, 64, 67, 71], // Cmaj7
  [64, 67, 71, 74], // Em7
  [65, 69, 72, 76], // Fmaj7
  [62, 67, 71, 74], // G
  [57, 60, 64, 67], // Am7
  [65, 69, 72, 76], // Fmaj7
  [62, 67, 71, 74], // G
  [60, 64, 67, 72], // C
];
const CLEAR_BASS = [48, 52, 53, 55, 45, 53, 55, 48];
/** 鈴のメロディ。[小節, 拍, MIDI, 長さ(拍)] */
const CLEAR_BELLS: [number, number, number, number][] = [
  [0, 0, 79, 1], [0, 1, 76, 1], [0, 2, 79, 1], [0, 3, 84, 1],
  [1, 0, 83, 2], [1, 2, 79, 1], [1, 3, 76, 1],
  [2, 0, 81, 1], [2, 1, 84, 1], [2, 2, 81, 1], [2, 3, 77, 1],
  [3, 0, 79, 1.5], [3, 2, 74, 1], [3, 3, 76, 1],
  [4, 0, 76, 1], [4, 1, 79, 1], [4, 2, 84, 1], [4, 3, 88, 1],
  [5, 0, 86, 1.5], [5, 2, 84, 1], [5, 3, 81, 1],
  [6, 0, 79, 1], [6, 1, 83, 1], [6, 2, 86, 1], [6, 3, 83, 1],
  [7, 0, 84, 3],
];
/** 後半（9〜16小節目）: 9〜12 はビートを抜いてしっとり、13〜16 は高く広がって頭へ */
const CLEAR_BELLS_B: [number, number, number, number][] = [
  [8, 0, 76, 1], [8, 1, 79, 1], [8, 2, 81, 1], [8, 3, 79, 1],
  [9, 0, 83, 2], [9, 2, 79, 1], [9, 3, 76, 1],
  [10, 0, 77, 1], [10, 1, 81, 1], [10, 2, 84, 1], [10, 3, 81, 1],
  [11, 0, 79, 3],
  [12, 0, 81, 1], [12, 1, 84, 1], [12, 2, 88, 1], [12, 3, 86, 1],
  [13, 0, 84, 1.5], [13, 2, 81, 1], [13, 3, 79, 1],
  [14, 0, 83, 1], [14, 1, 86, 1], [14, 2, 83, 1], [14, 3, 79, 1],
  [15, 0, 84, 2], [15, 2, 88, 2],
];

export const SONGS: Record<FixedTrack, Song> = {
  morning: {
    title: "しらかばの朝",
    bpm: 82,
    bars: 16,
    bar(ctx, out, b, t0, beat) {
      const at = (x: number) => t0 + x * beat;
      const a = b % 8; // 和音の巡りは 8 小節
      const chord = a < 6 ? MORNING_CHORDS[Math.floor(a / 2)] : a === 6 ? MORNING_CHORDS[3] : MORNING_CHORDS[4];
      const root = MORNING_BASS[Math.floor(a / 2)];
      const quiet = b >= 8 && b < 12; // 9〜12 小節目: ビートを抜いて、しっとり
      // 雪の風（前半・後半の頭で1回、小節8つぶん）
      if (a === 0) wind(ctx, out, t0, beat * 4 * 8 + 1, quiet ? 0.035 : 0.025);
      // レコードのパチパチ（lo-fi の質感）
      crackle(ctx, out, t0, beat * 4, 0.018, 2.5);
      if (quiet) {
        // エレピは1拍目に長く置く（パッド代わり）＋3拍目に軽く
        for (const m of chord) epiano(ctx, out, m, lag(at(0) + (m % 3) * 0.008), beat * 3.6, vel(0.07));
        for (const m of chord) epiano(ctx, out, m + 12, lag(at(2.5) + (m % 3) * 0.004), beat * 1.2, vel(0.03));
        bass(ctx, out, root, at(0), beat * 3.2, vel(0.2, 0.06));
        bass(ctx, out, root + 7, at(3), beat * 0.8, vel(0.12, 0.06));
        kick(ctx, out, at(0), vel(0.18, 0.06));
        hat(ctx, out, lag(at(2), 8), vel(0.018, 0.2), 0.05);
      } else {
        // エレピの和音を裏拍で軽く（1拍半・3拍半）。偶数小節は3拍半だけ
        for (const x of b % 2 === 0 ? [1.5, 3.5] : [1.5, 2.5, 3.5]) for (const m of chord) epiano(ctx, out, m, lag(at(x) + (m % 3) * 0.004), beat * 1.2, vel(x === 2.5 ? 0.05 : 0.08));
        // 三角波ベース: ドン（1拍）・ド（2拍半）・5度（3拍）
        bass(ctx, out, root, at(0), beat * 0.9, vel(0.22, 0.06));
        bass(ctx, out, root, at(2.5), beat * 0.4, vel(0.14, 0.06));
        bass(ctx, out, root + 7, at(3), beat * 0.8, vel(0.16, 0.06));
        // ゆるいビート: キック 1・2拍半、ブラシのスネア 2・4、ハットは8分（少しスウィング）
        kick(ctx, out, at(0), vel(0.3, 0.06));
        kick(ctx, out, at(2.5), vel(0.2, 0.08));
        snare(ctx, out, lag(at(1), 8), vel(0.07));
        snare(ctx, out, lag(at(3), 8), vel(0.08));
        for (let i = 0; i < 8; i++) hat(ctx, out, lag(at(i / 2 + (i % 2 ? 0.08 : 0)), 10), vel(i % 2 ? 0.02 : 0.035, 0.2), 0.035);
        // 16 小節目の終わり: ブラシの小さなフィル（頭に戻る合図）
        if (b === 15) for (let i = 0; i < 3; i++) snare(ctx, out, at(3.25 + i * 0.25), 0.04 + i * 0.015);
      }
      // 前半は鈴の合いの手、後半はメロディ（9〜12 エレピ・13〜16 鈴）
      for (const [bar, x, m, d] of MORNING_BELLS) if (bar === b) bell(ctx, out, m, lag(at(x)), beat * d * 1.5, vel(0.09));
      for (const [bar, x, m, d] of MORNING_MELODY_B) {
        if (bar !== b) continue;
        if (quiet) epiano(ctx, out, m, lag(at(x)), beat * d * 1.1, vel(0.1));
        else bell(ctx, out, m, lag(at(x)), beat * d * 1.4, vel(0.1));
      }
    },
  },
  mission: {
    title: "出撃！",
    bpm: 120,
    bars: 16,
    bar(ctx, out, b, t0, beat) {
      const at = (x: number) => t0 + x * beat;
      const chord = MISSION_CHORDS[b % 8];
      const root = MISSION_BASS[b % 8];
      const chorus = b >= 8; // 9〜16 小節目: サビ（パッドが明るく、エレピは刻み、リードが歌い続ける）
      // パッド（キックに合わせて少しへこませる＝サイドチェイン風）
      const duck = ctx.createGain();
      duck.connect(out);
      duck.gain.setValueAtTime(1, t0);
      for (let i = 0; i < 4; i++) {
        duck.gain.setValueAtTime(0.35, at(i));
        duck.gain.linearRampToValueAtTime(1, at(i) + beat * 0.6);
      }
      pad(ctx, duck, chord.map((m) => m + 12), t0, beat * 4.2, chorus ? 0.034 : 0.028, chorus ? 2000 : 1400);
      // ベース: 8分で根音とオクターブ上を交互に（ドゥン・ドゥン）
      for (let i = 0; i < 8; i++) bass(ctx, out, root + (i % 2 ? 12 : 0), at(i / 2), beat * 0.42, vel(i % 2 ? 0.14 : 0.22, 0.06));
      // 四つ打ちキック・雪を踏むザッザッ（2・4拍）・ハット（裏）
      for (let i = 0; i < 4; i++) kick(ctx, out, at(i), 0.42);
      crunch(ctx, out, at(1), vel(0.16));
      crunch(ctx, out, at(3), vel(0.18));
      for (let i = 0; i < 4; i++) hat(ctx, out, lag(at(i + 0.5), 8), vel(0.045, 0.2));
      if (b % 4 === 3) hat(ctx, out, at(3.75), 0.04);
      // 8・16 小節目の終わり: スネアのフィル（上がっていく）→ 次へ
      if (b === 15) for (let i = 0; i < 4; i++) snare(ctx, out, at(3 + i * 0.25), 0.06 + i * 0.02);
      if (b === 7) for (let i = 0; i < 2; i++) snare(ctx, out, at(3.5 + i * 0.25), 0.06 + i * 0.02);
      // 1〜4 はエレピのアルペジオ（8分で上がる）、5〜8 は矩形波のメロディ、サビはエレピの刻み（1拍半・3拍）
      if (b < 4) for (let i = 0; i < 8; i++) epiano(ctx, out, chord[i % 4] + (i >= 4 ? 12 : 0), lag(at(i / 2), 10), beat * 0.9, vel(0.07));
      else if (!chorus) for (const m of chord) epiano(ctx, out, m + 12, lag(at(1.5)), beat * 1.5, vel(0.05));
      else for (const x of [1.5, 3]) for (const m of chord) epiano(ctx, out, m + 12, lag(at(x)), beat * 0.8, vel(0.045));
      for (const [bar, x, m, d] of MISSION_LEAD) if (bar === b) lead(ctx, out, m, lag(at(x), 10), beat * d * 0.9, vel(0.05, 0.08));
      for (const [bar, x, m, d] of MISSION_LEAD_B) if (bar === b) lead(ctx, out, m, lag(at(x), 10), beat * d * 0.9, vel(0.06, 0.08));
    },
  },
  clear: {
    title: "灯りがともる",
    bpm: 100,
    bars: 16,
    intro(ctx, out, at) {
      // ファンファーレ 1.2 秒: C-E-G-C の鈴＋エレピの和音
      const run = [72, 76, 79, 84];
      run.forEach((m, i) => bell(ctx, out, m, at + i * 0.12, 1.4, 0.16));
      for (const m of [60, 64, 67, 71]) epiano(ctx, out, m, at + 0.36, 1.2, 0.1);
      for (let i = 0; i < 6; i++) bell(ctx, out, 91 + [0, 4, 7][i % 3], at + 0.5 + i * 0.07, 0.6, 0.05);
      return 1.2;
    },
    bar(ctx, out, b, t0, beat) {
      const at = (x: number) => t0 + x * beat;
      const chord = CLEAR_CHORDS[b % 8];
      const root = CLEAR_BASS[b % 8];
      const quiet = b >= 8 && b < 12; // 9〜12 小節目: ビートを抜いて、灯りの下でひと息
      const wide = b >= 12; // 13〜16 小節目: 高く広がる
      // エレピのアルペジオ（上がって下りる 8分）。しっとりの間はゆっくり（4分）
      const arp = [chord[0], chord[1], chord[2], chord[3], chord[2], chord[1], chord[3], chord[1]];
      if (quiet) for (let i = 0; i < 4; i++) epiano(ctx, out, arp[i], lag(at(i), 10), beat * 1.6, vel(i === 0 ? 0.08 : 0.06));
      else for (let i = 0; i < 8; i++) epiano(ctx, out, arp[i], lag(at(i / 2), 10), beat * 0.8, vel(i === 0 ? 0.09 : 0.065));
      if (wide) pad(ctx, out, chord.map((m) => m + 12), t0, beat * 4.2, 0.022, 1600);
      // ベース: 根音（1拍、長め）・5度（3拍）・根音（4拍、短く）
      bass(ctx, out, root, at(0), beat * (quiet ? 3.2 : 1.4), vel(0.22, 0.06));
      if (!quiet) {
        bass(ctx, out, root + 7, at(2), beat * 0.8, vel(0.16, 0.06));
        bass(ctx, out, root, at(3), beat * 0.4, vel(0.14, 0.06));
      }
      // キック 1・3、クラップ 2・4、ハット 8分（しっとりの間はハットだけ）
      if (quiet) {
        hat(ctx, out, lag(at(1), 8), vel(0.02, 0.2), 0.05);
        hat(ctx, out, lag(at(3), 8), vel(0.02, 0.2), 0.05);
      } else {
        kick(ctx, out, at(0), vel(0.32, 0.06));
        kick(ctx, out, at(2), vel(0.26, 0.06));
        clap(ctx, out, lag(at(1), 8), vel(0.09));
        clap(ctx, out, lag(at(3), 8), vel(0.1));
        for (let i = 0; i < 8; i++) hat(ctx, out, lag(at(i / 2), 8), vel(i % 2 ? 0.025 : 0.035, 0.2));
      }
      // 鈴のメロディ（前半）・後半のメロディ（13〜16 はエレピが1オクターブ下で重なる）
      for (const [bar, x, m, d] of CLEAR_BELLS) if (bar === b) bell(ctx, out, m, lag(at(x), 10), beat * d * 1.3, vel(0.12));
      for (const [bar, x, m, d] of CLEAR_BELLS_B) {
        if (bar !== b) continue;
        bell(ctx, out, m, lag(at(x), 10), beat * d * 1.3, vel(quiet ? 0.09 : 0.12));
        if (wide) epiano(ctx, out, m - 12, lag(at(x), 12), beat * d * 1.1, vel(0.05));
      }
      if (b === 7 || b === 15) for (let i = 0; i < 5; i++) bell(ctx, out, 96 + [0, 4, 7, 11, 12][i], at(3) + i * 0.08, 0.7, 0.05);
      // 12 小節目の終わり: クラップのフィル（広がる合図）
      if (b === 11) for (let i = 0; i < 3; i++) clap(ctx, out, at(3 + i * 0.33), 0.05 + i * 0.02);
    },
  },
};

export const LOOP_SECONDS = (s: Song): number => (60 / s.bpm) * 4 * s.bars;

/**
 * 今朝の雪の歌（v1.28）: 音符データ（lib/sound/snow-song.ts）を鳴らせる曲にする。
 * groove でリズムの組み方を変える（lofi＝しらかばの朝の仲間・drive＝四つ打ち・ballad＝ほぼビートなし・march＝行進）
 */
export function songFromData(d: SnowSong): Song {
  const byBar = (notes: SnowSong["melody"]) => {
    const m = new Map<number, SnowSong["melody"]>();
    for (const n of notes) m.set(n[0], [...(m.get(n[0]) ?? []), n]);
    return m;
  };
  const mel = byBar(d.melody);
  const spk = byBar(d.sparkle);
  return {
    title: d.title,
    bpm: d.bpm,
    bars: d.bars,
    intro(ctx, out, at) {
      // はじまりの合図: その曲の最初の和音を鈴で上がる（0.8 秒）
      d.chords[0].forEach((m, i) => bell(ctx, out, m + 12, at + i * 0.1, 1.2, 0.08));
      return 0.8;
    },
    bar(ctx, out, b, t0, beat) {
      const at = (x: number) => t0 + x * beat;
      const chord = d.chords[b % d.chords.length];
      const root = d.bass[b % d.bass.length];
      if (b === 0 && d.wind > 0) wind(ctx, out, t0, beat * 4 * d.bars + 1, 0.01 + 0.035 * d.wind);
      switch (d.groove) {
        case "drive": {
          pad(ctx, out, chord.map((m) => m + 12), t0, beat * 4.1, 0.024, 1300);
          for (let i = 0; i < 8; i++) bass(ctx, out, root + (i % 2 ? 12 : 0), at(i / 2), beat * 0.42, i % 2 ? 0.13 : 0.2);
          for (let i = 0; i < 4; i++) kick(ctx, out, at(i), 0.36);
          for (let i = 0; i < 4; i++) hat(ctx, out, at(i + 0.5), 0.04);
          if (d.crunch) {
            crunch(ctx, out, at(1), 0.14);
            crunch(ctx, out, at(3), 0.16);
          } else {
            clap(ctx, out, at(1), 0.07);
            clap(ctx, out, at(3), 0.08);
          }
          break;
        }
        case "ballad": {
          pad(ctx, out, chord, t0, beat * 4.3, 0.03, 900);
          for (const m of chord) epiano(ctx, out, m, at(0) + (m % 3) * 0.01, beat * 3.5, 0.05);
          bass(ctx, out, root, at(0), beat * 3, 0.16);
          if (b % 2 === 1) kick(ctx, out, at(0), 0.14);
          hat(ctx, out, at(2), 0.015, 0.05);
          break;
        }
        case "march": {
          pad(ctx, out, chord, t0, beat * 4.1, 0.022, 1100);
          for (let i = 0; i < 4; i++) bass(ctx, out, i % 2 ? root + 7 : root, at(i), beat * 0.6, 0.2);
          kick(ctx, out, at(0), 0.4);
          kick(ctx, out, at(2), 0.34);
          snare(ctx, out, at(1), 0.1);
          snare(ctx, out, at(3), 0.11);
          if (b % 4 === 3) for (let i = 0; i < 4; i++) snare(ctx, out, at(3 + i * 0.25), 0.05 + i * 0.015);
          if (d.crunch) for (const x of [0.5, 2.5]) crunch(ctx, out, at(x), 0.1);
          break;
        }
        default: {
          crackle(ctx, out, t0, beat * 4, 0.016, 2.5); // lo-fi のパチパチ
          for (const x of b % 2 === 0 ? [1.5, 3.5] : [1.5, 2.5, 3.5]) for (const m of chord) epiano(ctx, out, m, lag(at(x) + (m % 3) * 0.004), beat * 1.2, vel(x === 2.5 ? 0.045 : 0.07));
          bass(ctx, out, root, at(0), beat * 0.9, 0.2);
          bass(ctx, out, root, at(2.5), beat * 0.4, 0.13);
          bass(ctx, out, root + 7, at(3), beat * 0.8, 0.15);
          kick(ctx, out, at(0), 0.28);
          kick(ctx, out, at(2.5), 0.18);
          snare(ctx, out, at(1), 0.06);
          snare(ctx, out, at(3), 0.07);
          for (let i = 0; i < 8; i++) hat(ctx, out, lag(at(i / 2 + (i % 2 ? 0.08 : 0)), 10), vel(i % 2 ? 0.02 : 0.032, 0.2), 0.035);
          if (d.crunch) crunch(ctx, out, at(3), 0.07);
        }
      }
      for (const [, x, m, len] of mel.get(b) ?? []) {
        if (d.lead === "lead") lead(ctx, out, m, lag(at(x), 10), beat * len * 0.9, vel(0.05, 0.08));
        else if (d.lead === "epiano") epiano(ctx, out, m, lag(at(x)), beat * len * 1.1, vel(0.1));
        else bell(ctx, out, m, lag(at(x)), beat * len * 1.4, vel(0.11));
      }
      for (const [, x, m, len] of spk.get(b) ?? []) bell(ctx, out, m, lag(at(x)), beat * len * 1.6, vel(0.045));
    },
  };
}

let snowSong: { key: string; song: Song } | null = null;

/** 今朝の雪の歌を登録する（ホームが置く）。同じ曲なら何もしない */
export function setSnowSong(d: SnowSong | null): void {
  const key = d ? `${d.date}|${d.title}|${d.by}|${d.melody.length}` : "";
  if ((snowSong?.key ?? "") === key) return;
  snowSong = d ? { key, song: songFromData(d) } : null;
  if (current?.track === "snow") {
    current.player.stop();
    current = null;
  }
  scheduleApply();
}

function songFor(track: BgmTrack): Song {
  return track === "snow" ? (snowSong?.song ?? SONGS.morning) : SONGS[track];
}

// ---- 演奏（2つの時計）----
const LOOKAHEAD = 0.15;
const TICK_MS = 25;
const FADE = 0.6;

class Player {
  private nextBar = 0;
  private nextTime = 0;
  private timer: number | undefined;
  readonly gain: GainNode;
  constructor(
    private ctx: AudioContext,
    private song: Song,
    out: AudioNode,
  ) {
    this.gain = ctx.createGain();
    this.gain.gain.value = 0;
    this.gain.connect(out);
  }
  start(): void {
    const now = this.ctx.currentTime + 0.05;
    this.gain.gain.setValueAtTime(0, now);
    this.gain.gain.linearRampToValueAtTime(1, now + FADE);
    setBgmTempo(this.song.bpm); // やまびこの間隔を曲に合わせる
    this.nextTime = now + (this.song.intro ? this.song.intro(this.ctx, this.gain, now) : 0);
    this.nextBar = 0;
    this.tick();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }
  private tick(): void {
    const beat = 60 / this.song.bpm;
    const barSec = beat * 4;
    // 裏から戻って時計が大きく進んでいたら、過ぎた小節をまとめて鳴らさず、いまから続きを予約する
    if (this.nextTime < this.ctx.currentTime - barSec) this.nextTime = this.ctx.currentTime + 0.05;
    let guard = 0;
    while (this.nextTime < this.ctx.currentTime + LOOKAHEAD && guard++ < 4) {
      try {
        this.song.bar(this.ctx, this.gain, this.nextBar, this.nextTime, beat);
      } catch (e) {
        console.warn("BGM の予約に失敗", e); // 1小節の失敗で止めない
      }
      this.nextBar = (this.nextBar + 1) % this.song.bars;
      this.nextTime += barSec;
    }
  }
  stop(): void {
    if (this.timer !== undefined) window.clearInterval(this.timer);
    this.timer = undefined;
    try {
      const now = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(now);
      this.gain.gain.setValueAtTime(this.gain.gain.value, now);
      this.gain.gain.linearRampToValueAtTime(0, now + FADE);
      window.setTimeout(() => this.gain.disconnect(), (FADE + 0.2) * 1000);
    } catch {
      /* 閉じた AudioContext（作り直したあと）では何もしない */
    }
  }
}

let current: { track: BgmTrack; player: Player } | null = null;
/** 画面が「この曲を」と頼んだ順の積み重ね（最後に頼んだものが鳴る。画面が消えたら外す） */
const stack: { id: number; track: BgmTrack; level: number }[] = [];
let seq = 0;
let applyTimer: number | undefined;
let hooked = false;

function want(): { track: BgmTrack; level: number } | null {
  return stack.length ? stack[stack.length - 1] : null;
}

function apply(): void {
  applyTimer = undefined;
  const w = want();
  const e = getEngine();
  if (!e || !isUnlocked()) return; // 解放されたら onUnlocked でもう一度
  if (!w || !soundPrefs().bgm) {
    if (current) {
      current.player.stop();
      current = null;
    }
    delete document.documentElement.dataset.bgm;
    return;
  }
  setBgmLevel(w.level);
  if (current?.track === w.track) return;
  current?.player.stop();
  const player = new Player(e.ctx, songFor(w.track), e.bgm);
  player.start();
  current = { track: w.track, player };
  document.documentElement.dataset.bgm = w.track; // 確かめ用（scripts/sound-check.cjs が読む）
}

function scheduleApply(): void {
  if (!hooked) {
    hooked = true;
    onUnlocked(scheduleApply);
    onSoundPrefs(scheduleApply);
    // AudioContext を作り直したら、鳴っていた曲を新しい入れ物で鳴らし直す（解放されたら onUnlocked が apply を呼ぶ）
    onRebuild(() => {
      current?.player.stop();
      current = null;
      delete document.documentElement.dataset.bgm;
    });
  }
  if (applyTimer !== undefined) return;
  applyTimer = window.setTimeout(apply, 0); // 画面の入れかわり（消える→出る）を1回にまとめる
}

/** この画面の BGM を頼む。返り値で外す */
export function requestBgm(track: BgmTrack, level = 1): () => void {
  const id = ++seq;
  stack.push({ id, track, level });
  scheduleApply();
  return () => {
    const i = stack.findIndex((s) => s.id === id);
    if (i >= 0) stack.splice(i, 1);
    scheduleApply();
  };
}

/** いま鳴っている曲（確認用） */
export function currentBgm(): BgmTrack | null {
  return current?.track ?? null;
}
