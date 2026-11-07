import { describe, expect, it } from "vitest";
import { LOOP_SECONDS, SONGS } from "./bgm";

/** AudioContext の代わり: 予約した音の時刻を集める */
function fakeCtx() {
  const starts: number[] = [];
  const param = () => ({ value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {}, cancelScheduledValues: () => {} });
  const node = (kind: string) => ({ kind, type: "", frequency: param(), detune: param(), gain: param(), Q: param(), buffer: null, loop: false, connect: () => {}, disconnect: () => {}, start: (t: number) => starts.push(t), stop: () => {} });
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    createOscillator: () => node("osc"),
    createGain: () => node("gain"),
    createBiquadFilter: () => node("filter"),
    createStereoPanner: () => ({ ...node("panner"), pan: param() }),
    createBufferSource: () => node("noise"),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  } as unknown as BaseAudioContext;
  return { ctx, starts, out: node("out") as unknown as AudioNode };
}

describe("BGM の音符データ", () => {
  it("3曲とも 16 小節で、ループの長さが拍から計算どおり", () => {
    expect(Object.keys(SONGS).sort()).toEqual(["clear", "mission", "morning"]);
    expect(LOOP_SECONDS(SONGS.morning)).toBeCloseTo((60 / 82) * 64, 5);
    expect(LOOP_SECONDS(SONGS.mission)).toBeCloseTo(32, 5);
    expect(LOOP_SECONDS(SONGS.clear)).toBeCloseTo(38.4, 5);
  });
  it("どの小節も音を予約し、予約は小節の中（始まりから1小節＋少し）に収まる", () => {
    for (const song of Object.values(SONGS)) {
      const beat = 60 / song.bpm;
      for (let b = 0; b < song.bars; b++) {
        const { ctx, starts, out } = fakeCtx();
        song.bar(ctx, out, b, 100, beat);
        expect(starts.length, `${song.title} ${b + 1}小節目`).toBeGreaterThan(4);
        for (const t of starts) {
          expect(t, `${song.title} ${b + 1}小節目`).toBeGreaterThanOrEqual(100);
          expect(t, `${song.title} ${b + 1}小節目`).toBeLessThan(100 + beat * 4 + 0.001);
        }
      }
    }
  });
  it("後半（9〜16小節目）は前半と違う鳴り方（音の数が同じ小節は半分もない）", () => {
    for (const song of Object.values(SONGS)) {
      const beat = 60 / song.bpm;
      let same = 0;
      for (let b = 0; b < 8; b++) {
        const a = fakeCtx();
        song.bar(a.ctx, a.out, b, 100, beat);
        const c = fakeCtx();
        song.bar(c.ctx, c.out, b + 8, 100, beat);
        if (a.starts.length === c.starts.length) same++;
      }
      expect(same, song.title).toBeLessThan(4);
    }
  });
  it("「灯りがともる」のファンファーレは 1.2 秒", () => {
    const { ctx, starts, out } = fakeCtx();
    expect(SONGS.clear.intro!(ctx, out, 3)).toBeCloseTo(1.2);
    expect(starts.length).toBeGreaterThan(4);
  });
});
