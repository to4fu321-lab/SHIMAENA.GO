// 今朝の雪の歌（spec v1.28）: その朝の雪・気温・風・時刻・今日の話題から作る、その日だけの短い曲の「音符データ」。
// サーバー（Claude に作曲してもらう・点検する・プログラムで作曲する）と画面（lib/sound/bgm.ts の songFromData で鳴らす）の両方で使う。
// 音ファイルは使わない。音符は MIDI 番号（60 = C4）、拍は 4/4 の 0〜3.75（16分音符きざみ）。

export type SongGroove = "lofi" | "drive" | "ballad" | "march";
export type SongLead = "bell" | "epiano" | "lead";
/** [小節, 拍, MIDI, 長さ(拍)] */
export type SongNote = [number, number, number, number];

export interface SnowSong {
  date: string;
  /** 曲の名前（12字まで） */
  title: string;
  /** なぜこういう曲か（60字まで） */
  explain: string;
  bpm: number;
  bars: number;
  groove: SongGroove;
  lead: SongLead;
  /** 小節ごとの和音（2〜5音） */
  chords: number[][];
  /** 小節ごとのベースの根音 */
  bass: number[];
  melody: SongNote[];
  /** 高い鈴の合いの手（なくてもよい） */
  sparkle: SongNote[];
  /** 雪の風の音の強さ 0〜1 */
  wind: number;
  /** 雪を踏む音（ザッ）を2・4拍に */
  crunch: boolean;
  by: "claude" | "program";
}

/** 曲の材料（その朝の事実） */
export interface SongFacts {
  date: string;
  /** 予報・積もった雪（cm） */
  snowCm: number;
  snowName?: string;
  tempMinC?: number;
  windMaxMs?: number;
  /** 6〜9 朝 / 10〜15 昼 / 16〜18 夕 / それ以外 夜（その時の JST の時） */
  hour: number;
  /** 今日の話題（lib/topic/day.ts） */
  topics: string[];
}

export const BPM_MIN = 60;
export const BPM_MAX = 132;
export const BAR_CHOICES = [8, 12, 16, 24, 32];
export const TITLE_MAX = 12;
export const EXPLAIN_MAX = 60;
export const MELODY_MIN = 12;
export const MELODY_MAX = 256;
export const MELODY_LOW = 55;
export const MELODY_HIGH = 96;
const GROOVES: SongGroove[] = ["lofi", "drive", "ballad", "march"];
const LEADS: SongLead[] = ["bell", "epiano", "lead"];

const q = (x: number) => Math.round(x * 4) / 4; // 16分音符きざみ
const clampInt = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(x)));
const finite = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const clean = (s: unknown, max: number) => (typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, max) : "");

/** Claude の答え（JSON）の形。音符は読みやすいように {bar, beat, midi, len} で受け取る */
export interface SongDraft {
  title: string;
  explain: string;
  bpm: number;
  bars: number;
  groove: string;
  lead: string;
  chords: number[][];
  bass: number[];
  melody: { bar: number; beat: number; midi: number; len: number }[];
  sparkle: { bar: number; beat: number; midi: number; len: number }[];
  wind: number;
  crunch: boolean;
}

function notesOf(list: SongDraft["melody"], bars: number, lo: number, hi: number, max: number, mono: boolean): SongNote[] {
  const out: SongNote[] = [];
  for (const n of list ?? []) {
    if (![n.bar, n.beat, n.midi, n.len].every(finite)) continue;
    const bar = Math.round(n.bar);
    const beat = q(n.beat);
    if (bar < 0 || bar >= bars || beat < 0 || beat >= 4) continue;
    const midi = Math.round(n.midi);
    if (midi < lo || midi > hi) continue;
    const start = bar * 4 + beat;
    const len = Math.min(q(Math.min(4, Math.max(0.25, n.len))), bars * 4 - start);
    if (len < 0.25) continue;
    out.push([bar, beat, midi, len]);
  }
  out.sort((a, b) => a[0] * 4 + a[1] - (b[0] * 4 + b[1]));
  if (!mono) return out.slice(0, max);
  // 1本のメロディ: 同じ時刻は最初の1音、次の音にかかる長さは切る
  const mel: SongNote[] = [];
  for (const n of out) {
    const start = n[0] * 4 + n[1];
    const prev = mel[mel.length - 1];
    if (prev) {
      const ps = prev[0] * 4 + prev[1];
      if (ps === start) continue;
      if (ps + prev[3] > start) prev[3] = q(start - ps);
    }
    mel.push(n);
  }
  return mel.slice(0, max);
}

/**
 * 曲を点検して、鳴らしてよい形にそろえる（範囲の外は端に寄せる・足りない小節はくり返す・はみ出す音は切る）。
 * 直しきれない（和音がない・メロディの音が少なすぎる）ときは undefined
 */
export function tidySong(d: SongDraft, date: string, by: SnowSong["by"]): SnowSong | undefined {
  if (!d || !Array.isArray(d.chords)) return undefined;
  const bars = BAR_CHOICES.reduce((best, c) => (Math.abs(c - (finite(d.bars) ? d.bars : 16)) < Math.abs(best - (finite(d.bars) ? d.bars : 16)) ? c : best), 16);
  const rawChords = d.chords
    .map((c) => [...new Set((Array.isArray(c) ? c : []).filter(finite).map((m) => Math.round(m)).filter((m) => m >= 40 && m <= 84))].sort((a, b) => a - b).slice(0, 5))
    .filter((c) => c.length >= 2);
  if (rawChords.length === 0) return undefined;
  const chords = Array.from({ length: bars }, (_, i) => rawChords[i % rawChords.length]);
  const rawBass = (Array.isArray(d.bass) ? d.bass : []).filter(finite);
  const bass = chords.map((c, i) => {
    const b = rawBass.length ? rawBass[i % rawBass.length] : c[0] - 12;
    let m = Math.round(b);
    while (m > 55) m -= 12;
    while (m < 28) m += 12;
    return m;
  });
  const melody = notesOf(d.melody, bars, MELODY_LOW, MELODY_HIGH, MELODY_MAX, true);
  if (melody.length < MELODY_MIN) return undefined;
  const sparkle = notesOf(d.sparkle ?? [], bars, 72, 100, 96, false);
  const title = clean(d.title, TITLE_MAX) || "今朝の雪の歌";
  return {
    date,
    title,
    explain: clean(d.explain, EXPLAIN_MAX),
    bpm: clampInt(finite(d.bpm) ? d.bpm : 84, BPM_MIN, BPM_MAX),
    bars,
    groove: GROOVES.includes(d.groove as SongGroove) ? (d.groove as SongGroove) : "lofi",
    lead: LEADS.includes(d.lead as SongLead) ? (d.lead as SongLead) : "bell",
    chords,
    bass,
    melody,
    sparkle,
    wind: Math.min(1, Math.max(0, finite(d.wind) ? d.wind : 0.3)),
    crunch: Boolean(d.crunch),
    by,
  };
}

/** 曲の長さ（秒、1周） */
export const songSeconds = (s: Pick<SnowSong, "bpm" | "bars">) => (60 / s.bpm) * 4 * s.bars;

// ---- プログラムの作曲（キーがないとき・Claude の曲が点検を通らないとき）。同じ朝の事実なら同じ曲、朝がちがえばちがう曲 ----

function rng(seed: string) {
  let a = 2166136261;
  for (const ch of seed) a = Math.imul(a ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => {
    a = (Math.imul(a ^ (a >>> 15), 2246822507) + 3266489909) >>> 0;
    return a / 2 ** 32;
  };
}

export type SongMood = "heroic" | "mysterious" | "sparkle" | "calm" | "bright" | "festive";

/** 朝の事実から曲の性格を決める（プログラムだけ） */
export function moodOf(f: SongFacts): SongMood {
  const festive = f.topics.some((t) => /クリスマス|正月|節分|まつり|祭|ひなまつり|バレンタイン|大晦日|小正月|七五三/.test(t));
  if (f.snowCm >= 20) return "heroic";
  if ((f.windMaxMs ?? 0) >= 10) return "mysterious";
  if (festive) return "festive";
  if ((f.tempMinC ?? 0) <= -6) return "sparkle";
  if (f.snowCm <= 0) return "calm";
  return "bright";
}

const MOOD: Record<SongMood, { bpm: number; groove: SongGroove; lead: SongLead; lo: number; hi: number; minor: boolean; wind: number; crunch: boolean; word: string }> = {
  heroic: { bpm: 96, groove: "march", lead: "lead", lo: 60, hi: 76, minor: false, wind: 0.5, crunch: true, word: "低い音で力強く、ザッザッと踏みしめる行進曲" },
  mysterious: { bpm: 92, groove: "lofi", lead: "epiano", lo: 64, hi: 81, minor: true, wind: 0.9, crunch: false, word: "風の音を大きく、短調でふしぎな感じ" },
  sparkle: { bpm: 90, groove: "lofi", lead: "bell", lo: 72, hi: 88, minor: false, wind: 0.3, crunch: false, word: "高い鈴で、粉雪がきらきら光るように軽く" },
  calm: { bpm: 74, groove: "ballad", lead: "epiano", lo: 62, hi: 79, minor: false, wind: 0.2, crunch: false, word: "ゆっくり静かに、雪を待つ朝のように" },
  bright: { bpm: 84, groove: "lofi", lead: "bell", lo: 67, hi: 84, minor: false, wind: 0.35, crunch: true, word: "明るく、散歩の足どりで" },
  festive: { bpm: 100, groove: "drive", lead: "bell", lo: 67, hi: 86, minor: false, wind: 0.2, crunch: true, word: "鈴をたくさん鳴らして、お祝いの気分で" },
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PROG_MAJOR = [
  [1, 6, 4, 5],
  [1, 5, 6, 4],
  [4, 5, 3, 6],
  [6, 4, 1, 5],
  [1, 4, 2, 5],
];
const PROG_MINOR = [
  [1, 6, 7, 1],
  [1, 4, 7, 3],
  [6, 7, 1, 1],
  [1, 7, 6, 7],
];
/** 1小節のリズム: [拍, 長さ] */
const RHYTHMS: [number, number][][] = [
  [[0, 1], [1, 1], [2, 1.5], [3.5, 0.5]],
  [[0, 0.5], [0.5, 0.5], [1, 1], [2, 2]],
  [[0, 1.5], [1.5, 0.5], [2, 1], [3, 1]],
  [[0, 2], [2, 1], [3, 1]],
  [[0, 1], [1, 0.5], [1.5, 0.5], [2, 1], [3, 1]],
  [[0.5, 0.5], [1, 1], [2, 0.5], [2.5, 0.5], [3, 1]],
];

const TITLES: Record<SongMood, string[]> = {
  heroic: ["どか雪マーチ", "白い山をこえて", "スコップ行進曲"],
  mysterious: ["ふぶきの小径", "風の音のワルツ", "白いトンネル"],
  sparkle: ["ダイヤモンドの朝", "きらきら粉雪", "しばれる朝の鈴"],
  calm: ["しずかな白", "雪を待つ朝", "ねむる町"],
  bright: ["白い朝の散歩", "雪の朝のうた", "ゆきみち日和"],
  festive: ["鈴の鳴る朝", "お祝いの雪", "白いパレード"],
};

/** 事実から作る、その朝だけの曲（キーなしでも毎朝ちがう） */
export function composeFallback(f: SongFacts): SnowSong {
  const r = rng(`${f.date}|${f.snowCm}|${f.tempMinC ?? ""}|${f.windMaxMs ?? ""}|${f.snowName ?? ""}|${f.topics.join(",")}`);
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const mood = moodOf(f);
  const m = MOOD[mood];
  const scale = m.minor ? MINOR : MAJOR;
  const tonic = pick([57, 60, 62, 64, 65, 67]); // A C D E F G
  const prog = pick(m.minor ? PROG_MINOR : PROG_MAJOR);
  const bars = 16;
  const degreeNote = (deg: number, step: number) => {
    const i = deg - 1 + step;
    return tonic + scale[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7);
  };
  const chordOf = (deg: number) => {
    const notes = [0, 2, 4, 6].map((s) => degreeNote(deg, s));
    // 和音は 55〜74 に寄せる
    return notes.map((n) => {
      let x = n;
      while (x > 74) x -= 12;
      while (x < 55) x += 12;
      return x;
    }).sort((a, b) => a - b);
  };
  const degrees = Array.from({ length: bars }, (_, b) => (b === bars - 1 ? 5 : prog[b % 4]));
  if (m.minor) degrees[bars - 1] = 7;
  const chords = degrees.map(chordOf);
  const bass = degrees.map((d) => {
    let x = degreeNote(d, 0) - 24;
    while (x < 33) x += 12;
    return x;
  });
  // メロディ: A（0〜3）・A'（4〜7）・B（8〜11、高め）・A''（12〜15、最後は主音へ）
  const pent = m.minor ? [0, 3, 5, 7, 10] : [0, 2, 4, 7, 9];
  const pool: number[] = [];
  for (let o = -2; o <= 3; o++) for (const p of pent) {
    const x = tonic + 12 * o + p;
    if (x >= m.lo && x <= m.hi) pool.push(x);
  }
  const near = (target: number, list: number[]) => list.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a), list[0]);
  const motif: { rhythm: [number, number][]; moves: number[] }[] = Array.from({ length: 4 }, () => ({ rhythm: pick(RHYTHMS), moves: Array.from({ length: 6 }, () => pick([-2, -1, -1, 0, 1, 1, 2])) }));
  const melody: SongNote[] = [];
  let cur = near((m.lo + m.hi) / 2, pool);
  for (let b = 0; b < bars; b++) {
    const phrase = Math.floor(b / 4);
    const inPhrase = b % 4;
    const base = motif[inPhrase];
    const rhythm = phrase === 2 && inPhrase % 2 === 1 ? pick(RHYTHMS) : base.rhythm;
    if (b === bars - 1) {
      // 終わり: 主音（ループの頭へ戻る前に、少し浮かせて5度でもよい）
      const tonics = pool.filter((x) => (((x - tonic) % 12) + 12) % 12 === 0);
      const home = tonics.length ? near((m.lo + m.hi) / 2, tonics) : cur;
      melody.push([b, 0, home, 1.5]);
      melody.push([b, 2, near(home + 7, pool), 2]);
      continue;
    }
    if (phrase === 2 && inPhrase === 0) cur = near(cur + 5, pool); // B は少し高く
    rhythm.forEach(([beat, len], i) => {
      const strong = beat === 0 || beat === 2;
      const chordTones = chords[b].flatMap((c) => [c - 12, c, c + 12, c + 24]).filter((x) => x >= m.lo && x <= m.hi);
      const idx = pool.indexOf(near(cur, pool));
      let next = pool[Math.min(pool.length - 1, Math.max(0, idx + base.moves[i % base.moves.length] * (phrase === 1 && inPhrase === 3 ? -1 : 1)))];
      if (strong && chordTones.length) next = near(next, chordTones);
      cur = next;
      melody.push([b, beat, next, len]);
    });
  }
  const sparkle: SongNote[] = [];
  if (mood === "sparkle" || mood === "festive" || mood === "bright") {
    for (let b = 1; b < bars; b += 2) {
      const top = pool.filter((x) => x + 12 <= 100).map((x) => x + 12);
      if (top.length) sparkle.push([b, 3.5, pick(top), 0.5]);
      if (mood !== "bright" && top.length) sparkle.push([b, 3.75, pick(top), 0.5]);
    }
  }
  const words = f.snowCm > 0 ? `${f.snowCm}cmの${f.snowName ?? "雪"}の朝なので` : "雪のない朝なので";
  const topic = f.topics[0];
  const title = (topic && r() < 0.4 ? `${topic}のうた` : pick(TITLES[mood])).slice(0, TITLE_MAX);
  return {
    date: f.date,
    title,
    explain: `${words}、${m.word}。`.slice(0, EXPLAIN_MAX),
    bpm: m.bpm + Math.round((r() - 0.5) * 8),
    bars,
    groove: m.groove,
    lead: m.lead,
    chords,
    bass,
    melody,
    sparkle,
    wind: m.wind,
    crunch: m.crunch,
    by: "program",
  };
}
