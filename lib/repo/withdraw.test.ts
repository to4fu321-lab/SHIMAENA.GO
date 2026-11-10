import { describe, expect, it } from "vitest";
import { deleteParticipantData, memoryRepo, resetMemoryRoster } from "./index";
import type { Base, Participant } from "../types";

describe("退会（11/10）: その人の登録と記録を消す", () => {
  it("参加者・家（拠点）・家族の紐づけ・ソロの記録が消え、ほかの人は残る", async () => {
    const me: Participant = { id: "p-me", nickname: "テスト", role: "requester", location: [43.04, 141.37], lineUserId: "U-me" };
    const other: Participant = { id: "p-other", nickname: "となり", role: "helper", location: [43.04, 141.37], lineUserId: "U-other" };
    const bases: Base[] = [{ id: "base-p-me", number: 1, requesterId: "p-me" }];
    resetMemoryRoster([me, other], bases);
    await memoryRepo.addFamilyLink({ familyLineUserId: "U-fam", requesterId: "p-me", linkCode: "123456" } as never);
    await memoryRepo.insertSoloLog({ id: "l1", participantId: "p-me", date: "2026-11-10", kind: "own_house", feathers: 1, at: "2026-11-10T07:00:00+09:00" } as never);

    await deleteParticipantData("p-me");

    expect(await memoryRepo.findParticipant("p-me")).toBeUndefined();
    expect(await memoryRepo.findParticipant("p-other")).toBeDefined();
    expect(await memoryRepo.findBaseByRequester("p-me")).toBeUndefined();
    expect(await memoryRepo.listFamilyLinksByRequester("p-me")).toEqual([]);
    expect(await memoryRepo.listSoloLogsByParticipant("p-me")).toEqual([]);
  });
});
