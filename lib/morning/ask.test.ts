// 雪かきを頼む（spec v1.10）: お願いする側が 6〜19時いつでも → 地図に雪かき待ち → 300m 以内の人へ LINE → 行く → 完了
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { finishRegistration, handleEvent } from "../line/handle";
import type { LineEvent } from "../line/types";
import { memoryRepo } from "../repo";
import type { Participant } from "../types";
import { emptyMorning } from "./flow";
import { askForHelp, completeManually, escalateHelpIfDue } from "./ops";
import { loadRoster } from "./roster";
import { loadMorning, saveMorning } from "./store";
import { pickAskTargets } from "./watch";

const HOME: [number, number] = [43.0401, 141.3699];
const helper: Participant = { id: "p-near", nickname: "近所", role: "helper", location: [43.0405, 141.3703], lineUserId: "U-near", teamId: "lupinus", morningMinutes: 30, hasTools: true };
const ev = (userId: string, rest: Record<string, unknown>): LineEvent => ({ replyToken: "rt", source: { type: "user", userId }, timestamp: 0, ...rest }) as LineEvent;
const say = (userId: string, text: string) => handleEvent(ev(userId, { type: "message", message: { id: String(Math.random()), type: "text", text } }));

let log: ReturnType<typeof vi.spyOn>;
const out = () => log.mock.calls.map((c) => `${c[0]} ${c[1] ?? ""}`).join("\n");
const pushesTo = (to: string) => log.mock.calls.filter((c) => String(c[0]).includes("/message/push") && String(c[1]).includes(`"to":"${to}"`)).length;

beforeEach(async () => {
  for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive", "__shimaenaConcierge"]) delete (globalThis as Record<string, unknown>)[k];
  log = vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-04T10:00:00+09:00"));
  // 前の雪の日の記録が残っている（今日ではない）
  await saveMorning(emptyMorning({ date: "2026-10-30", forecastCm: 0 }));
  await finishRegistration("U-gp", { role: "requester", proxy: false, location: HOME, soloMinutes: 15, clearArea: "entrance" } as never);
  await memoryRepo.upsertParticipant(helper);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("雪かきを頼む", () => {
  it("雪のない日: 今日の記録を始め、家を雪かき待ちにし、300m 以内の人へ LINE", async () => {
    await say("U-gp", "雪かきを頼む");
    const s = await loadMorning();
    expect(s.morning.rollcall.date).toBe("2026-11-04");
    expect(s.morning.rollcall.status).toBe("planned");
    const m = s.morning.missions.find((x) => x.ask)!;
    expect(m.status).toBe("short");
    expect(out()).toContain("雪かき待ち");
    expect(pushesTo("U-near")).toBe(1);
    expect(s.askSends?.["p-near"]).toBe(1);
  });

  it("同じ家は1日1回。もう出ていれば「もう地図に出ています」", async () => {
    await say("U-gp", "雪かきを頼む");
    await say("U-gp", "雪かきを頼む");
    expect(out()).toContain("もう地図に「雪かき待ち」で出ています");
    expect((await loadMorning()).morning.missions.filter((x) => x.ask)).toHaveLength(1);
    expect(pushesTo("U-near")).toBe(1);
  });

  it("手伝う側・夜は頼めない（決まった返事）", async () => {
    await say("U-near", "雪かきを頼む");
    expect(out()).toContain("お願いする側として登録した家");
    vi.setSystemTime(new Date("2026-11-04T20:00:00+09:00"));
    await say("U-gp", "雪かきを頼む");
    expect(out()).toContain("明日の朝6時から頼めます");
  });

  it("知らせを受けた人が「行く」→ 完了まで今までの流れで進む", async () => {
    await say("U-gp", "雪かきを頼む");
    const m = (await loadMorning()).morning.missions.find((x) => x.ask)!;
    await handleEvent(ev("U-near", { type: "postback", postback: { data: `help:go=${m.id}` } }));
    const going = (await loadMorning()).morning.sorties.find((x) => x.participantId === "p-near");
    expect(going?.missionId).toBe(m.id);
    const r = await completeManually("p-near");
    expect(r.done).toBe(true);
    expect((await loadMorning()).morning.missions.find((x) => x.id === m.id)?.status).toBe("done");
  });

  it("月の通数を守る: 1人1日3回まで。600m・1km には広げない", async () => {
    await askForHelp("U-gp");
    const s = await loadMorning();
    const m = s.morning.missions.find((x) => x.ask)!;
    s.askSends = { "p-near": 3 };
    expect(pickAskTargets(s, await loadRoster(), { ...m, id: "other" }).map((p) => p.id)).not.toContain("p-near");
    vi.setSystemTime(new Date("2026-11-04T11:00:00+09:00"));
    expect(await escalateHelpIfDue()).toBe(0);
  });
});
