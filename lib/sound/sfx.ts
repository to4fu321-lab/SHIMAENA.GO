// 効果音の一覧（spec v1.19 の 3「効果音」）。1つ1つが「いつ・どんな音か」の設計。
// どれも 0.05〜0.7 秒。at は AudioContext の時刻（予約して鳴らせる）。
import { bell, clap, crunch, epiano, hz, noise, notes, tone } from "./synth";

export type SfxFn = (ctx: BaseAudioContext, out: AudioNode, at: number) => void;

export const SFX = {
  // ---- 全画面で共通（ボタン） ----
  /** 「ポッ」ふつうのボタン */
  tap: (c, o, t) => tone(c, o, { f: 620, f1: 330, at: t, dur: 0.07, gain: 0.18 }),
  /** 「ピポッ」主役のボタン（雪かきGO・出発する・終わりました） */
  confirm: (c, o, t) => notes(c, o, t, [[76, 0, 0.08], [81, 0.07, 0.14]], { type: "sine", gain: 0.2 }),
  /** 「プッ」戻る・あとで・閉じる */
  back: (c, o, t) => tone(c, o, { f: 420, f1: 240, at: t, dur: 0.08, gain: 0.14 }),
  /** 「カチッ」チェックを付ける */
  toggleOn: (c, o, t) => {
    noise(c, o, { at: t, dur: 0.03, gain: 0.12, filter: { type: "highpass", f: 3000 } });
    tone(c, o, { f: 1100, at: t, dur: 0.06, gain: 0.12 });
  },
  /** 「コッ」チェックを外す */
  toggleOff: (c, o, t) => {
    noise(c, o, { at: t, dur: 0.03, gain: 0.1, filter: { type: "highpass", f: 2000 } });
    tone(c, o, { f: 700, at: t, dur: 0.06, gain: 0.1 });
  },
  /** 「ブッ」うまくいかなかった */
  error: (c, o, t) => {
    tone(c, o, { f: 220, f1: 180, at: t, dur: 0.12, type: "square", gain: 0.06 });
    tone(c, o, { f: 200, f1: 160, at: t + 0.16, dur: 0.16, type: "square", gain: 0.06 });
  },

  // ---- 出動の流れ ----
  /** 「シュッ→ピンポンパン」行く・出発する */
  go: (c, o, t) => {
    noise(c, o, { at: t, dur: 0.18, gain: 0.12, filter: { type: "bandpass", f: 500, f1: 3200, q: 1.5 } });
    notes(c, o, t + 0.1, [[72, 0, 0.12], [76, 0.1, 0.12], [79, 0.2, 0.25]], { type: "sine", gain: 0.2 });
  },
  /** 「ドーン＋タタタン」MISSION START の全画面 */
  missionStart: (c, o, t) => {
    tone(c, o, { f: 110, f1: 40, at: t, dur: 0.5, type: "sine", gain: 0.6 });
    noise(c, o, { at: t, dur: 0.25, gain: 0.2, filter: { type: "lowpass", f: 1200, f1: 200 } });
    notes(c, o, t + 0.1, [[60, 0, 0.1], [64, 0.09, 0.1], [67, 0.18, 0.1], [72, 0.27, 0.45]], { type: "square", gain: 0.07, detune: 5, decay: "lin" });
  },
  /** 「パパパパーン＋シャララ」MISSION CLEAR */
  missionClear: (c, o, t) => {
    notes(c, o, t, [[72, 0, 0.14], [76, 0.12, 0.14], [79, 0.24, 0.14], [84, 0.36, 0.7]], { type: "sine", gain: 0.24 });
    notes(c, o, t, [[60, 0, 0.14], [64, 0.12, 0.14], [67, 0.24, 0.14], [72, 0.36, 0.7]], { type: "triangle", gain: 0.12 });
    for (let i = 0; i < 10; i++) bell(c, o, 91 + [0, 2, 4, 7, 9][i % 5] + (i > 4 ? 12 : 0), t + 0.45 + i * 0.045, 0.5, 0.05);
  },
  /** 「ぽわん」家に灯りがともる */
  lamp: (c, o, t) => {
    tone(c, o, { f: hz(76), at: t, dur: 1.4, type: "sine", gain: 0.2, attack: 0.08 });
    tone(c, o, { f: hz(83), at: t + 0.05, dur: 1.2, type: "sine", gain: 0.08, attack: 0.12 });
  },
  /** 「ヒュ〜ン」雪 HP が減る */
  hpDown: (c, o, t) => tone(c, o, { f: 800, f1: 180, at: t, dur: 0.9, type: "triangle", gain: 0.1, decay: "lin" }),
  /** 「カッ」数が増える1刻み（pitch で上げていく） */
  countTick: (c, o, t) => tone(c, o, { f: 900, at: t, dur: 0.04, type: "square", gain: 0.04 }),
  /** 「ポン」数え終わり */
  countPop: (c, o, t) => notes(c, o, t, [[79, 0, 0.08], [86, 0.06, 0.3]], { type: "sine", gain: 0.2 }),
  /** 「ピピピッ」目標の時間に届いた */
  timerGoal: (c, o, t) => {
    for (let i = 0; i < 3; i++) tone(c, o, { f: 1320, at: t + i * 0.14, dur: 0.08, type: "square", gain: 0.05 });
  },
  /** 「カシャッ」写真 */
  shutter: (c, o, t) => {
    noise(c, o, { at: t, dur: 0.03, gain: 0.25, filter: { type: "highpass", f: 2500 } });
    noise(c, o, { at: t + 0.07, dur: 0.05, gain: 0.18, filter: { type: "highpass", f: 1500 } });
  },
  /** 「ピッピッ」人手不足の家が新しく出た */
  helpAlert: (c, o, t) => {
    tone(c, o, { f: 1046, at: t, dur: 0.09, type: "square", gain: 0.05 });
    tone(c, o, { f: 1046, at: t + 0.16, dur: 0.09, type: "square", gain: 0.05 });
  },
  /** 勝利のファンファーレ: 全軒完了（討伐） */
  bossDown: (c, o, t) => {
    const seq: [number, number, number][] = [[67, 0, 0.12], [67, 0.12, 0.12], [67, 0.24, 0.12], [72, 0.36, 0.5], [71, 0.8, 0.14], [72, 0.94, 0.14], [74, 1.08, 0.14], [79, 1.22, 0.9]];
    notes(c, o, t, seq, { type: "sine", gain: 0.24 });
    notes(c, o, t, seq.map(([m, a, d]) => [m - 12, a, d]), { type: "triangle", gain: 0.12 });
    for (let i = 0; i < 12; i++) bell(c, o, 96 + [0, 4, 7, 12][i % 4], t + 1.25 + i * 0.05, 0.6, 0.05);
  },
  /** 「ピン」だれかの完了のトースト */
  toast: (c, o, t) => bell(c, o, 88, t, 0.7, 0.12),

  // ---- カード演出（CardReveal の CSS に同期） ----
  /** 「フワッ」下から上がる */
  cardRise: (c, o, t) => noise(c, o, { at: t, dur: 0.5, gain: 0.1, attack: 0.1, decay: "lin", filter: { type: "lowpass", f: 300, f1: 2400, q: 0.8 } }),
  /** 「シュルッ」めくれる */
  cardFlip: (c, o, t) => {
    noise(c, o, { at: t, dur: 0.35, gain: 0.12, filter: { type: "bandpass", f: 1200, f1: 3500, q: 2 } });
    tone(c, o, { f: 500, f1: 1400, at: t, dur: 0.3, type: "sine", gain: 0.05, decay: "lin" });
  },
  /** 「キラ〜ン」光が走る */
  cardSparkle: (c, o, t) => {
    const run = [84, 88, 91, 96, 100, 103, 108];
    run.forEach((m, i) => bell(c, o, m, t + i * 0.045, 0.6, 0.07));
  },
  /** 「ドンッ」消印 */
  cardStamp: (c, o, t) => {
    tone(c, o, { f: 100, f1: 38, at: t, dur: 0.35, type: "sine", gain: 0.7 });
    noise(c, o, { at: t, dur: 0.08, gain: 0.3, filter: { type: "lowpass", f: 900 } });
  },
  /** 「ピン」名前と番号が出る */
  cardChime: (c, o, t) => bell(c, o, 91, t, 1.0, 0.16),
  /** 「キラキラキラ」レアのホログラム */
  cardHolo: (c, o, t) => {
    for (let i = 0; i < 9; i++) bell(c, o, 96 + [0, 4, 7, 11, 14][i % 5] + (i >= 5 ? 5 : 0), t + i * 0.07, 0.5, 0.05);
  },

  // ---- 隊長・トーク・応援 ----
  /** 「ピヨッ」シマエナ隊長 */
  chirp: (c, o, t) => {
    tone(c, o, { f: 1800, f1: 2600, at: t, dur: 0.07, type: "sine", gain: 0.1 });
    tone(c, o, { f: 2100, f1: 2900, at: t + 0.1, dur: 0.08, type: "sine", gain: 0.09 });
  },
  /** 「パタパタ」飛ぶ（小さく） */
  flap: (c, o, t) => {
    for (let i = 0; i < 5; i++) noise(c, o, { at: t + i * 0.13, dur: 0.07, gain: 0.05, filter: { type: "lowpass", f: 700 } });
  },
  /** 「ポロン」隊長トークに新しい文 */
  message: (c, o, t) => {
    bell(c, o, 79, t, 0.5, 0.14);
    bell(c, o, 84, t + 0.11, 0.8, 0.14);
  },
  /** 「シュッ」送った */
  send: (c, o, t) => noise(c, o, { at: t, dur: 0.14, gain: 0.1, filter: { type: "bandpass", f: 800, f1: 4000, q: 1.5 } }),
  /** 「パチパチ＋ポン」応援 */
  cheer: (c, o, t) => {
    for (const d of [0, 0.09, 0.17, 0.27]) clap(c, o, t + d, 0.12);
    bell(c, o, 88, t + 0.3, 0.8, 0.12);
  },
  /** 「ぽわん」ありがとう */
  thanks: (c, o, t) => {
    epiano(c, o, 72, t, 0.9, 0.16);
    epiano(c, o, 76, t + 0.03, 0.9, 0.12);
    epiano(c, o, 79, t + 0.06, 0.9, 0.1);
  },

  // ---- はじめ・使い方・クイズ ----
  /** 「ピロリン」ようこそ・チーム発表 */
  welcome: (c, o, t) => {
    notes(c, o, t, [[72, 0, 0.1], [76, 0.08, 0.1], [79, 0.16, 0.1], [84, 0.24, 0.5]], { type: "sine", gain: 0.2 });
    bell(c, o, 96, t + 0.3, 0.9, 0.1);
  },
  /** 「ドロロロ…」発表の前 */
  drumroll: (c, o, t) => {
    for (let i = 0; i < 16; i++) noise(c, o, { at: t + i * 0.05, dur: 0.04, gain: 0.08 + i * 0.006, filter: { type: "bandpass", f: 1200, q: 1 } });
  },
  /** 「ザクッ」スコップが雪に入る */
  dig: (c, o, t) => {
    crunch(c, o, t, 0.3);
    noise(c, o, { at: t + 0.04, dur: 0.14, gain: 0.14, filter: { type: "lowpass", f: 1500, f1: 300 } });
  },
  /** 「ピンポン」正解 */
  quizOk: (c, o, t) => notes(c, o, t, [[81, 0, 0.12], [88, 0.14, 0.4]], { type: "sine", gain: 0.2 }),
  /** 「ブブー」はずれ */
  quizNg: (c, o, t) => {
    tone(c, o, { f: 196, at: t, dur: 0.18, type: "square", gain: 0.06, decay: "lin" });
    tone(c, o, { f: 185, at: t + 0.22, dur: 0.3, type: "square", gain: 0.06, decay: "lin" });
  },
  /** 「ピロン」共有・コピーできた */
  share: (c, o, t) => notes(c, o, t, [[84, 0, 0.08], [91, 0.07, 0.25]], { type: "sine", gain: 0.16 }),
} satisfies Record<string, SfxFn>;

export type SfxName = keyof typeof SFX;
export const SFX_NAMES = Object.keys(SFX) as SfxName[];

/** 振動（Android だけ効く。iPhone は無視）。手袋でも「押せた」と分かるように、主役の場面だけ */
export const VIBRATE_MS: Partial<Record<SfxName, number>> = {
  confirm: 12,
  go: 20,
  missionStart: 25,
  missionClear: 30,
  cardStamp: 30,
  bossDown: 40,
  welcome: 20,
};
