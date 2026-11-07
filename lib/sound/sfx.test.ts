import { describe, expect, it } from "vitest";
import { SFX, SFX_NAMES, VIBRATE_MS } from "./sfx";

/** AudioContext の代わり: 何が予約されたかだけ数える */
function fakeCtx() {
  const calls: string[] = [];
  const param = () => ({ value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} });
  const node = (kind: string) => ({
    kind,
    type: "",
    frequency: param(),
    detune: param(),
    gain: param(),
    Q: param(),
    buffer: null,
    loop: false,
    connect: () => {},
    start: (t: number) => calls.push(`${kind}@${t.toFixed(3)}`),
    stop: () => {},
  });
  const ctx = {
    sampleRate: 8000,
    createOscillator: () => node("osc"),
    createGain: () => node("gain"),
    createBiquadFilter: () => node("filter"),
    createStereoPanner: () => ({ ...node("panner"), pan: param() }),
    createBufferSource: () => node("noise"),
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
  } as unknown as BaseAudioContext;
  return { ctx, calls, out: node("out") as unknown as AudioNode };
}

describe("効果音の一覧", () => {
  it("全部が音を予約する（空の効果音がない）", () => {
    for (const name of SFX_NAMES) {
      const { ctx, calls, out } = fakeCtx();
      SFX[name](ctx, out, 1);
      expect(calls.length, name).toBeGreaterThan(0);
    }
  });
  it("予約は at より前にならない", () => {
    for (const name of SFX_NAMES) {
      const { ctx, calls, out } = fakeCtx();
      SFX[name](ctx, out, 5);
      for (const c of calls) expect(Number(c.split("@")[1]), `${name}: ${c}`).toBeGreaterThanOrEqual(5);
    }
  });
  it("振動は実在する効果音にだけ付く", () => {
    for (const k of Object.keys(VIBRATE_MS)) expect(SFX_NAMES).toContain(k);
  });
});
