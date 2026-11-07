import { describe, expect, it } from "vitest";
import { bluetoothSupported, parseHeartRate } from "./heart-rate";

const view = (...bytes: number[]) => new DataView(Uint8Array.from(bytes).buffer);

describe("心拍の読み取り（Bluetooth Heart Rate Measurement）", () => {
  it("8bit の値", () => {
    expect(parseHeartRate(view(0x00, 72))).toBe(72);
  });
  it("16bit の値（flags の bit0）", () => {
    expect(parseHeartRate(view(0x01, 0x2c, 0x01))).toBeUndefined(); // 0x012c = 300 → 範囲外
    expect(parseHeartRate(view(0x01, 0x70, 0x00))).toBe(112);
  });
  it("短すぎる・ありえない値は読まない", () => {
    expect(parseHeartRate(view(0x00))).toBeUndefined();
    expect(parseHeartRate(view(0x01, 0x70))).toBeUndefined();
    expect(parseHeartRate(view(0x00, 0))).toBeUndefined();
  });
  it("使える端末か", () => {
    expect(bluetoothSupported({ bluetooth: {} })).toBe(true);
    expect(bluetoothSupported({})).toBe(false);
  });
});
