// お互いさま（spec v1.10）: お願いする側も本人の LINE があればチームに入り、出動できる
import { beforeEach, describe, expect, it, vi } from "vitest";
import { finishRegistration } from "./line/handle";
import { textOf } from "./line/flex";
import type { LineMessage } from "./line/types";
import { ensureTeam, onTeam } from "./member";
import { DEMO_DATE, fillAnswers } from "./morning/flow";
import { announce, offerTaskNow, plan, ring } from "./morning/ops";
import { loadRoster } from "./morning/roster";
import { loadMorning, saveMorning } from "./morning/store";
import { pickTaskNow } from "./morning/watch";
import { memoryRepo } from "./repo";
import type { Participant } from "./types";

const t = (ms: LineMessage[]) => ms.map(textOf).join("\n");

beforeEach(() => {
  for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive"]) delete (globalThis as Record<string, unknown>)[k];
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("チームに入る人", () => {
  it("手伝う側と、本人の LINE があるお願いする側。家族の代理（LINE なし）は入らない", () => {
    expect(onTeam({ role: "helper", teamId: "lupinus" })).toBe(true);
    expect(onTeam({ role: "requester", teamId: "lupinus", lineUserId: "U" })).toBe(true);
    expect(onTeam({ role: "requester", teamId: "lupinus" })).toBe(false);
    expect(onTeam({ role: "requester", lineUserId: "U" })).toBe(false);
  });

  it("お願いする側の本人の登録でチームに入る。家族の代理では入らない", async () => {
    await finishRegistration("U-gp", { role: "requester", proxy: false, location: [43.0401, 141.3699], soloMinutes: 10, clearArea: "entrance" } as never);
    expect((await memoryRepo.findParticipantByLineUserId("U-gp"))?.teamId).toBeTruthy();
    await finishRegistration("U-fam", { role: "requester", proxy: true, location: [43.0402, 141.37], soloMinutes: 0, clearArea: "entrance" } as never);
    const all = await loadRoster();
    const proxy = all.participants.find((p) => p.registeredByFamilyId === "U-fam");
    expect(proxy?.teamId).toBeUndefined();
  });

  it("前に登録したお願いする側の人は、あとからチームに入る", async () => {
    const old: Participant = { id: "p-old", nickname: "前の人", role: "requester", location: [43.04, 141.37], lineUserId: "U-old", soloMinutes: 15, clearArea: "entrance", level: 2 };
    await memoryRepo.upsertParticipant(old);
    const next = await ensureTeam(old);
    expect(next.teamId).toBeTruthy();
    expect((await memoryRepo.findParticipant("p-old"))?.teamId).toBe(next.teamId);
  });
});

describe("お願いする側も出動できる", () => {
  it("作戦中の朝、チームのあるお願いする側にも近くの手伝いを出す（自分の家は出さない）", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    const s = await loadMorning();
    fillAnswers(s, await loadRoster(), 5);
    await saveMorning(s);
    await plan();
    const roster = await loadRoster();
    // 架空のお願いする側の人に本人の LINE とチームを付ける
    const gp = roster.participants.find((p) => p.role === "requester" && roster.bases.some((b) => b.requesterId === p.id))!;
    const me: Participant = { ...gp, lineUserId: "U-gp2", teamId: "lupinus" };
    await memoryRepo.upsertParticipant(me);
    const r2 = await loadRoster();
    const offer = pickTaskNow(await loadMorning(), r2, me, 60);
    const myBase = r2.bases.find((b) => b.requesterId === me.id)!;
    if (offer) expect(offer.mission.baseId).not.toBe(myBase.id);
    expect(t(await offerTaskNow(me.id, 60, new Date(`${DEMO_DATE}T08:00:00+09:00`)))).not.toContain("手伝う方のメニュー");
  });
});
