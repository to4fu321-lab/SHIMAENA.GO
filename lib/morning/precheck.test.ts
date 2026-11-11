// 写真の確認（Claude）は順番の鍵の外で先に行い、鍵の中ではその結果を使う（11/11）
import { describe, expect, it, vi } from "vitest";

const calls: { lockHeld: boolean }[] = [];
vi.mock("../claude/photo", async (orig) => {
  const real = await orig<typeof import("../claude/photo")>();
  const { isLockHeld } = await import("../ops/lock");
  return {
    ...real,
    checkPhoto: vi.fn(async (img: Parameters<typeof real.checkPhoto>[0]) => {
      calls.push({ lockHeld: isLockHeld() });
      return real.checkPhoto(img);
    }),
  };
});

describe("写真の確認を鍵の外で", () => {
  it("先に確かめた結果を使い、鍵の中では Claude を呼ばない。完了はそのまま進む", async () => {
    const { DEMO_DATE, fillAnswers } = await import("./flow");
    const { announce, completeWithPhoto, plan, precheckPhoto, ring } = await import("./ops");
    const { loadRoster } = await import("./roster");
    const { loadMorning, saveMorning } = await import("./store");
    const { withStateLock } = await import("../ops/lock");
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    const s = await loadMorning();
    fillAnswers(s, await loadRoster(), 7);
    await saveMorning(s);
    await plan();
    const going = (await loadMorning()).morning.sorties.find((x) => x.status === "going")!;
    const photo = { bytes: new Uint8Array([9, 8, 7, 6]), mediaType: "image/jpeg" as const };
    calls.length = 0;
    await precheckPhoto(going.participantId, photo);
    const r = await withStateLock("test", () => completeWithPhoto(going.participantId, photo));
    expect(r.done).toBe(true);
    expect(calls).toEqual([{ lockHeld: false }]); // 1回だけ・鍵の外で
  });

  it("先に確かめていない写真は、今までどおり鍵の中で確かめる", async () => {
    const { completeWithPhoto } = await import("./ops");
    const { loadMorning } = await import("./store");
    const going = (await loadMorning()).morning.sorties.find((x) => x.status === "going");
    if (!going) return; // 全部終わっていたら確かめる家がない
    calls.length = 0;
    await completeWithPhoto(going.participantId, { bytes: new Uint8Array([5, 4, 3, 2, 1]), mediaType: "image/jpeg" });
    expect(calls).toHaveLength(1);
  });
});
