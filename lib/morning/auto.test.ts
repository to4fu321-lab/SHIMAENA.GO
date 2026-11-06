// spec v1.20: 頼む家は事前登録（おまかせ／一緒に）。10cm 以上積もった朝 6:30 に、質問なしで雪かき待ちにして近所へ知らせる。
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finishRegistration } from "../line/handle";
import { listThread } from "../inbox/store";
import { memoryRepo } from "../repo";
import type { Participant } from "../types";
import { emptyMorning, TOGETHER_NOTE } from "./flow";
import { askForHelp, morningAuto } from "./ops";
import { loadMorning, saveMorning } from "./store";

const HOME: [number, number] = [43.0401, 141.3699];
const helper: Participant = { id: "p-near", nickname: "近所", role: "helper", location: [43.0405, 141.3703], lineUserId: "U-near", teamId: "lupinus", morningMinutes: 30, hasTools: true };

/** Open-Meteo の答え（きのう 6 時から今朝 6 時まで、1時間ごとに perHour cm） */
function fakeSnow(perHour: number) {
  const time: string[] = [];
  const snowfall: number[] = [];
  for (let d = 0; d < 3; d++) {
    for (let h = 0; h < 24; h++) {
      time.push(`2026-12-${String(13 + d).padStart(2, "0")}T${String(h).padStart(2, "0")}:00`);
      snowfall.push(perHour);
    }
  }
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    if (u.includes("open-meteo") && u.includes("hourly")) return new Response(JSON.stringify({ hourly: { time, snowfall } }));
    return new Response("{}", { status: 404 });
  });
}

beforeEach(async () => {
  for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive", "__shimaenaConcierge", "__shimaenaInbox"]) delete (globalThis as Record<string, unknown>)[k];
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-12-14T06:30:00+09:00"));
  await saveMorning(emptyMorning({ date: "2026-12-01", forecastCm: 0 }));
  await finishRegistration("U-oma", { role: "requester", proxy: false, location: HOME, soloMinutes: "unknown", clearArea: "entrance", helpStyle: "omakase" });
  await finishRegistration("U-tog", { role: "requester", proxy: false, location: [43.0398, 141.3702], soloMinutes: 30, clearArea: "entrance", helpStyle: "together" });
  await memoryRepo.upsertParticipant(helper);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("10cm 以上積もった朝（spec v1.20）", () => {
  it("質問なしで、登録した家が頼み方のとおり雪かき待ちになり、近所の人に知らせが届く", async () => {
    vi.stubGlobal("fetch", fakeSnow(0.5)); // 24時間で 12cm
    const r = await morningAuto();
    expect(r.started).toBe(true);
    expect(r.snowCm).toBe(12);
    const s = await loadMorning();
    expect(s.morning.rollcall.status).toBe("planned");
    const oma = (await memoryRepo.findParticipantByLineUserId("U-oma"))!;
    const tog = (await memoryRepo.findParticipantByLineUserId("U-tog"))!;
    expect(s.answers.find((a) => a.participantId === oma.id)?.answer).toBe("no");
    expect(s.answers.find((a) => a.participantId === tog.id)).toMatchObject({ answer: "together", request: { note: TOGETHER_NOTE } });
    const togBase = (await memoryRepo.findBaseByRequester(tog.id))!;
    expect(s.morning.missions.find((m) => m.baseId === togBase.id)?.request?.note).toBe(TOGETHER_NOTE);
    // 「今朝、玄関から出られそう？」は送らない。手伝う人には待っている家の数
    const all = (await Promise.all(["U-oma", "U-tog", "U-near"].map((k) => listThread(k)))).flat().map((x) => JSON.stringify(x.body)).join("\n");
    expect(all).not.toContain("出られそう");
    expect((await listThread("U-near")).map((x) => JSON.stringify(x.body)).join("")).toContain("助けてほしい家が");
  });

  it("10cm に届かない朝は何もしない", async () => {
    vi.stubGlobal("fetch", fakeSnow(0.2)); // 24時間で 5cm
    const r = await morningAuto();
    expect(r.started).toBe(false);
    expect((await loadMorning()).morning.rollcall.date).toBe("2026-12-01");
  });
});

describe("今日頼むときも頼み方を分けられる", () => {
  it("一緒にやる → 必要な人数が1人へり、手伝う人に「家の人も一緒に」", async () => {
    vi.setSystemTime(new Date("2026-12-14T10:00:00+09:00"));
    await askForHelp("U-oma", new Date(), "together");
    const s = await loadMorning();
    const oma = (await memoryRepo.findParticipantByLineUserId("U-oma"))!;
    const m = s.morning.missions.find((x) => x.ask)!;
    expect(m.request?.note).toBe(TOGETHER_NOTE);
    expect(s.answers.find((a) => a.participantId === oma.id)?.answer).toBe("together");
  });
});
