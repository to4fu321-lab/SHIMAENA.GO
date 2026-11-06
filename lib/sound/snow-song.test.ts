import { describe, expect, it } from "vitest";
import { composeFallback, moodOf, songSeconds, tidySong, type SnowSong, type SongDraft, type SongFacts } from "./snow-song";
import { songFromData } from "./bgm";

const facts = (o: Partial<SongFacts> = {}): SongFacts => ({ date: "2026-12-14", snowCm: 12, snowName: "ぼた雪のドンブリ", tempMinC: -3, windMaxMs: 4, hour: 7, topics: [], ...o });

const toDraft = (s: SnowSong): SongDraft => ({
  ...s,
  melody: s.melody.map(([bar, beat, midi, len]) => ({ bar, beat, midi, len })),
  sparkle: s.sparkle.map(([bar, beat, midi, len]) => ({ bar, beat, midi, len })),
});

/** AudioContext の代わり（lib/sound/bgm.test.ts と同じ） */
function fakeCtx() {
  const starts: number[] = [];
  const param = () => ({ value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, cancelScheduledValues: () => {} });
  const node = () => ({ type: "", frequency: param(), detune: param(), gain: param(), Q: param(), buffer: null, loop: false, connect: () => {}, disconnect: () => {}, start: (t: number) => starts.push(t), stop: () => {} });
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    createOscillator: node,
    createGain: node,
    createBiquadFilter: node,
    createBufferSource: node,
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  } as unknown as BaseAudioContext;
  return { ctx, starts, out: node() as unknown as AudioNode };
}

describe("今朝の雪の歌（v1.28）の点検", () => {
  it("範囲の外は寄せ、重なる音は切り、足りない小節はくり返す", () => {
    const melody = Array.from({ length: 14 }, (_, i) => ({ bar: Math.floor(i / 2), beat: (i % 2) * 2 + 0.1, midi: 72, len: 3 }));
    const s = tidySong(
      { title: "とても長い長い長い曲の名前です", explain: "x", bpm: 300, bars: 15, groove: "polka", lead: "kazoo", chords: [[60, 64, 67], [999], [57, 60, 64]], bass: [], melody: [...melody, { bar: 0, beat: 0, midi: 200, len: 1 }, { bar: 99, beat: 0, midi: 70, len: 1 }], sparkle: [], wind: 3, crunch: true },
      "2026-12-14",
      "claude",
    )!;
    expect(s.bpm).toBe(132);
    expect(s.bars).toBe(16);
    expect(s.title.length).toBeLessThanOrEqual(12);
    expect(s.groove).toBe("lofi");
    expect(s.lead).toBe("bell");
    expect(s.chords).toHaveLength(16);
    expect(s.chords[1]).toEqual([57, 60, 64]); // 和音でないもの（999 だけ）は捨てて、残りをくり返す
    expect(s.bass.every((b) => b >= 28 && b <= 55)).toBe(true);
    expect(s.melody.every(([, beat]) => beat * 4 === Math.round(beat * 4))).toBe(true); // 16分きざみ
    expect(s.melody.some(([, , m]) => m === 200)).toBe(false);
    for (let i = 1; i < s.melody.length; i++) {
      const [b0, x0, , l0] = s.melody[i - 1];
      const [b1, x1] = s.melody[i];
      expect(b0 * 4 + x0 + l0).toBeLessThanOrEqual(b1 * 4 + x1); // 1本のメロディ
    }
    expect(s.wind).toBe(1);
  });

  it("和音がない・メロディが少なすぎる曲は使わない", () => {
    const base = { title: "a", explain: "", bpm: 80, bars: 8, groove: "lofi", lead: "bell", bass: [], sparkle: [], wind: 0, crunch: false };
    expect(tidySong({ ...base, chords: [], melody: [] }, "d", "claude")).toBeUndefined();
    expect(tidySong({ ...base, chords: [[60, 64, 67]], melody: [{ bar: 0, beat: 0, midi: 72, len: 1 }] }, "d", "claude")).toBeUndefined();
  });
});

describe("プログラムの作曲（キーなし）", () => {
  it("同じ朝なら同じ曲、朝がちがえばちがう曲", () => {
    const a = composeFallback(facts());
    expect(composeFallback(facts())).toEqual(a);
    expect(composeFallback(facts({ date: "2026-12-15" })).melody).not.toEqual(a.melody);
  });

  it("雪と気温で性格が変わる: ドカ雪は低く行進、しばれる粉雪は高い鈴", () => {
    expect(moodOf(facts({ snowCm: 25 }))).toBe("heroic");
    expect(moodOf(facts({ windMaxMs: 12 }))).toBe("mysterious");
    expect(moodOf(facts({ tempMinC: -9 }))).toBe("sparkle");
    expect(moodOf(facts({ topics: ["お正月"] }))).toBe("festive");
    const heavy = composeFallback(facts({ snowCm: 25 }));
    const powder = composeFallback(facts({ tempMinC: -9 }));
    const avg = (s: SnowSong) => s.melody.reduce((x, n) => x + n[2], 0) / s.melody.length;
    expect(heavy.groove).toBe("march");
    expect(powder.lead).toBe("bell");
    expect(avg(powder)).toBeGreaterThan(avg(heavy) + 6);
    expect(powder.sparkle.length).toBeGreaterThan(0);
  });

  it("プログラムの曲も点検を通り、そのままの形で残る", () => {
    for (const f of [facts(), facts({ snowCm: 0 }), facts({ snowCm: 30, windMaxMs: 15 }), facts({ tempMinC: -12, topics: ["クリスマス"] })]) {
      const s = composeFallback(f);
      const again = tidySong(toDraft(s), s.date, "program")!;
      expect(again.melody).toEqual(s.melody);
      expect(again.chords).toEqual(s.chords);
      expect(s.title.length).toBeLessThanOrEqual(12);
      expect(s.explain.length).toBeLessThanOrEqual(60);
      expect(songSeconds(s)).toBeGreaterThan(20);
    }
  });
});

describe("鳴らす（songFromData）", () => {
  it("どの小節も音を予約し、予約は小節の中に収まる（4つのリズムとも）", () => {
    for (const groove of ["lofi", "drive", "ballad", "march"] as const) {
      const song = songFromData({ ...composeFallback(facts()), groove });
      const beat = 60 / song.bpm;
      for (let b = 0; b < song.bars; b++) {
        const { ctx, starts, out } = fakeCtx();
        song.bar(ctx, out, b, 10, beat);
        expect(starts.length).toBeGreaterThan(3);
        expect(Math.min(...starts)).toBeGreaterThanOrEqual(10);
        expect(Math.max(...starts)).toBeLessThan(10 + beat * 4 + 0.05);
      }
    }
  });
});
