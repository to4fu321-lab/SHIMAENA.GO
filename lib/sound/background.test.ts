import { describe, expect, it } from "vitest";
import { encodeWav, foldTail } from "./background";

const buf = (chans: number[][], sampleRate = 8000) =>
  ({ numberOfChannels: chans.length, length: chans[0].length, sampleRate, getChannelData: (c: number) => Float32Array.from(chans[c]) }) as unknown as AudioBuffer;

describe("雪かき中の曲を裏で鳴らす（書き出し）", () => {
  it("尾（1周より後ろ）を頭に足して、ちょうど1周にする", () => {
    const out = foldTail(buf([[1, 2, 3, 4, 0.5, 0.25]]), 4);
    expect(out.length).toBe(4);
    expect(Array.from(out.getChannelData(0))).toEqual([1.5, 2.25, 3, 4]);
  });
  it("WAV の頭（RIFF・2ch・16bit・長さ）が正しい", async () => {
    const b = encodeWav(buf([[0, 1, -1], [0.5, -0.5, 0]], 32000));
    const v = new DataView(await b.arrayBuffer());
    const tag = (o: number) => String.fromCharCode(...[0, 1, 2, 3].map((i) => v.getUint8(o + i)));
    expect(tag(0)).toBe("RIFF");
    expect(tag(8)).toBe("WAVE");
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(32000);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(3 * 2 * 2);
    expect(v.getInt16(44 + 2, true)).toBe(16383); // 1 サンプル目の右 0.5
    expect(v.getInt16(44 + 4, true)).toBe(32767); // 2 サンプル目の左 1
    expect(v.getInt16(44 + 8, true)).toBe(-32768); // 3 サンプル目の左 -1
  });
});
