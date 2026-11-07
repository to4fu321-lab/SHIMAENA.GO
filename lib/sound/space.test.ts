import { describe, expect, it } from "vitest";
import { createSpace, reverbImpulse, softCurve } from "./space";

/** AudioContext の代わり: つないだ線と作ったノードを数える */
function fakeCtx() {
  const made: string[] = [];
  let edges = 0;
  const targets: number[] = [];
  const param = () => ({ value: 0, setValueAtTime: () => {}, setTargetAtTime: (v: number) => void targets.push(v), linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} });
  const node = (kind: string) => {
    made.push(kind);
    return { kind, type: "", frequency: param(), gain: param(), Q: param(), delayTime: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), buffer: null, connect: () => void edges++ };
  };
  const ctx = {
    sampleRate: 8000,
    currentTime: 0,
    createGain: () => node("gain"),
    createBiquadFilter: () => node("filter"),
    createDelay: () => node("delay"),
    createConvolver: () => node("convolver"),
    createDynamicsCompressor: () => node("comp"),
    createWaveShaper: () => ({ ...node("shaper"), curve: null, oversample: "none" }),
    createStereoPanner: () => ({ ...node("panner"), pan: param() }),
    createBuffer: (ch: number, len: number) => {
      const chans = Array.from({ length: ch }, () => new Float32Array(len));
      return { getChannelData: (i: number) => chans[i], length: len, numberOfChannels: ch };
    },
  } as unknown as BaseAudioContext;
  return { ctx, made, targets, edges: () => edges };
}

describe("BGM の響き", () => {
  it("残響の素は 2ch・2.4 秒で、頭は無音（プリディレイ）、終わりに向けて小さくなる", () => {
    const { ctx } = fakeCtx();
    const ir = reverbImpulse(ctx);
    expect(ir.numberOfChannels).toBe(2);
    expect(ir.length).toBe(Math.floor(8000 * 2.4));
    const d = ir.getChannelData(0);
    expect(d[0]).toBe(0);
    const rms = (from: number, to: number) => Math.sqrt(d.slice(from, to).reduce((s, x) => s + x * x, 0) / (to - from));
    expect(rms(200, 2000)).toBeGreaterThan(rms(8000, 10000));
    expect(rms(8000, 10000)).toBeGreaterThan(rms(17000, 19000));
    expect(reverbImpulse(ctx)).toBe(ir); // 同じ ctx では使い回す
  });
  it("やわらかい歪みの曲線は、小さい音はそのまま・大きい音は丸める", () => {
    const c = softCurve(1.7, 1001);
    expect(c[500]).toBeCloseTo(0, 6);
    expect(c[1000]).toBeLessThan(1);
    expect(c[1000]).toBeGreaterThan(0.5);
    expect(c[0]).toBeCloseTo(-c[1000], 6);
    expect(c[510] - c[500]).toBeCloseTo(0.02, 3); // 傾き 1（10 きざみ × 0.002）
  });
  it("やまびこ・残響・コンプレッサーを組み、テンポで付点8分の間隔になる", () => {
    const { ctx, made, targets, edges } = fakeCtx();
    const out = { connect: () => {} } as unknown as AudioNode;
    const space = createSpace(ctx, out);
    expect(space.input).toBeTruthy();
    expect(made).toContain("delay");
    expect(made).toContain("convolver");
    expect(made).toContain("comp");
    expect(made).toContain("shaper");
    expect(edges()).toBeGreaterThan(10);
    space.setTempo(120); // 1拍 0.5 秒 → 付点8分 0.375 秒
    expect(targets.at(-1)).toBeCloseTo(0.375, 5);
  });
});
