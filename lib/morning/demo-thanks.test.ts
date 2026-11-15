import { describe, expect, it } from "vitest";
import { listThread } from "../inbox/store";
import { DEMO_DATE, fillAnswers } from "./flow";
import { announce, completeManually, demoThanks, demoThanksSeconds, isDemoHouse, plan, ring } from "./ops";
import { loadRoster } from "./roster";
import { loadMorning, saveMorning } from "./store";

const texts = async (key: string) => (await listThread(key)).filter((x) => x.dir === "out").map((x) => JSON.stringify(x.body)).join("\n");

async function oneDoneFromMap() {
  await announce({ date: DEMO_DATE, forecastCm: 12 });
  await ring();
  const s = await loadMorning();
  fillAnswers(s, await loadRoster(), 7);
  await saveMorning(s);
  await plan();
  const going = (await loadMorning()).morning.sorties.find((x) => x.status === "going")!;
  // fast: 返事のあとの仕事を待たずに、その場で届ける（テストで順番を確かめるため）。echo: 地図から完了した
  const r = await completeManually(going.participantId, new Date(), { fast: true, echo: true });
  expect(r.done).toBe(true);
  return going;
}

describe("デモの時間圧縮と、完了の返事を隊長トークにも（spec v1.59）", () => {
  it("地図から完了すると、同じ返事が本人の隊長トークにも残る", async () => {
    const going = await oneDoneFromMap();
    expect(await texts(`demo:${going.participantId}`)).toContain("完了だしま〜");
  });

  it("架空の家を架空の人が終えたら、家の人の「ありがとう」をプログラムが代わりに届ける。1軒に1回だけ", async () => {
    const going = await oneDoneFromMap();
    const roster = await loadRoster();
    const before = await loadMorning();
    const mission = before.morning.missions.find((m) => m.id === going.missionId)!;
    const sorties = before.morning.sorties.filter((x) => x.missionId === mission.id);
    expect(isDemoHouse(roster, mission, sorties)).toBe(true);
    expect(before.thanks?.[mission.id]).toBeUndefined();
    const scores = before.morning.scores.length;

    expect(await demoThanks(mission.id)).toBe(true);
    const after = await loadMorning();
    expect(["ありがとう", "助かりました", "お茶どうぞ"]).toContain(after.thanks?.[mission.id]?.label);
    expect(after.morning.scores.length).toBe(scores); // 点は増えない
    const talk = await texts(`demo:${going.participantId}`);
    expect(talk).toContain("が届きました");
    expect(talk).toContain("デモのため"); // 早く届けていることを、正直に書く
    expect(after.log.join("\n")).toContain("デモ: 架空の家の人の代わりにプログラムが押した");
    expect(await demoThanks(mission.id)).toBe(false); // 2回目は届けない
  });

  it("本物の人が1人でもいる家・終わっていない家には、何もしない", async () => {
    const going = await oneDoneFromMap();
    const roster = await loadRoster();
    const s = await loadMorning();
    const mission = s.morning.missions.find((m) => m.id === going.missionId)!;
    const sorties = s.morning.sorties.filter((x) => x.missionId === mission.id);
    const real = { ...roster, participants: roster.participants.map((p) => (p.id === going.participantId ? { ...p, lineUserId: "U-real" } : p)) };
    expect(isDemoHouse(real, mission, sorties)).toBe(false);
    const realHome = { ...roster, participants: roster.participants.map((p) => (p.id === roster.bases.find((b) => b.id === mission.baseId)?.requesterId ? { ...p, lineUserId: "U-home" } : p)) };
    expect(isDemoHouse(realHome, mission, sorties)).toBe(false);
    const open = s.morning.missions.find((m) => m.status !== "done");
    if (open) expect(await demoThanks(open.id)).toBe(false);
  });

  it("待つ秒数: 既定は20秒、DEMO_THANKS_SECONDS で変えられ、0 で止まる。テストでは待たない", () => {
    expect(demoThanksSeconds({})).toBe(20);
    expect(demoThanksSeconds({ DEMO_THANKS_SECONDS: "45" })).toBe(45);
    expect(demoThanksSeconds({ DEMO_THANKS_SECONDS: "0" })).toBe(0);
    expect(demoThanksSeconds({ DEMO_THANKS_SECONDS: "9999" })).toBe(120);
    expect(demoThanksSeconds()).toBe(0);
  });
});
