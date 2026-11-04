import { describe, expect, it } from "vitest";
import { findPrivateAreas, tidyPrivacy } from "./privacy";

describe("写真のぼかす場所", () => {
  it("箱の向きを直し、少し広げ、写真の外は切る", () => {
    const r = tidyPrivacy({ areas: [{ kind: "plate", x0: 600, y0: 800, x1: 400, y1: 700 }] });
    expect(r.whole).toBe(false);
    const b = r.boxes[0];
    expect(b.x).toBeLessThan(0.4);
    expect(b.x + b.w).toBeGreaterThan(0.6);
    const edge = tidyPrivacy({ areas: [{ kind: "face", x0: 950, y0: 0, x1: 1000, y1: 100 }] }).boxes[0];
    expect(edge.x + edge.w).toBeLessThanOrEqual(1);
    expect(edge.y).toBe(0);
  });
  it("数字でない箱は使わない", () => {
    expect(tidyPrivacy({ areas: [{ kind: "house", x0: Number.NaN, y0: 0, x1: 10, y1: 10 }] }).boxes).toHaveLength(0);
  });
  it("Claude のキーがないときは写真全体をぼかす", async () => {
    const old = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const r = await findPrivateAreas({ bytes: new Uint8Array([0xff, 0xd8, 0xff]), mediaType: "image/jpeg" });
    expect(r.whole).toBe(true);
    if (old) process.env.ANTHROPIC_API_KEY = old;
  });
});
