import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: () => { throw new Error("no request"); } }));
import { within } from "./deadline";

const wait = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

describe("待つのは長くても数秒", () => {
  it("間に合えば結果を返す", async () => {
    expect(await within("t", Promise.resolve(3), 50)).toEqual({ done: true, value: 3 });
  });
  it("間に合わなければ先に返し、仕事は裏で続けて、終わったら知らせる", async () => {
    const seen: number[] = [];
    const r = await within("t", wait(80).then(() => 7), 20, async (v) => void seen.push(v));
    expect(r).toEqual({ done: false });
    expect(seen).toEqual([]);
    await wait(120);
    expect(seen).toEqual([7]);
  });
});
