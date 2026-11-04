// 今朝の先生（spec v1.6）: お願いする側のコツを集め、今朝の雪に合う1つを行き先カードへ。新しい知恵は作らない
import { describe, expect, it } from "vitest";
import { mockTeacher, pickTeacher } from "../claude/teacher";
import { actionsOf, textOf } from "../line/flex";
import { MSG } from "../line/messages";
import type { FlexMessage, LineMessage } from "../line/types";
import { memoryRepo } from "../repo";
import { DEMO_DATE, fillAnswers } from "./flow";
import { announce, answerRollcall, plan, ring, tipReceive, tipStart } from "./ops";
import { loadRoster } from "./roster";
import { loadMorning, saveMorning } from "./store";
import { addTip, loadTips, tipOk, type Tip } from "./tips";

const t = (m: LineMessage | LineMessage[]) => [m].flat().map(textOf).join("\n");
const tip = (id: string, text: string): Tip => ({ id, participantId: "x", text, at: "2026-12-01T00:00:00Z" });

describe("今朝の先生", () => {
  it("名前や番号の入ったコツは載せない", () => {
    expect(tipOk("雪は朝のうちにやらんと重くなるよ")).toBe(true);
    expect(tipOk("佐藤さんに聞くといい")).toBe(false);
    expect(tipOk("090-1234-5678 まで")).toBe(false);
  });

  it("今朝の雪に合うものを選ぶ（凍る朝は滑り、大雪は重さ）。なければ何も出さない", async () => {
    const tips = [tip("a", "雪は朝のうちにやらんと重くなるよ"), tip("b", "凍った所には砂をまくと滑らん"), tip("c", "重い雪は少しずつ、腰を落として")];
    expect(mockTeacher({ cm: 6, tempMinC: -8, tips })?.tipId).toBe("b");
    expect(mockTeacher({ cm: 20, tempMinC: 0, tips })?.tipId).toBe("c");
    expect(await pickTeacher({ cm: 12, tips: [] })).toBeUndefined();
  });

  it("点呼に答えたお願いする側に聞く → 「教える」→ 次の文がコツに → 作戦の時に選ばれて行き先カードへ", async () => {
    await memoryRepo.upsertParticipant({ id: "p-sensei", nickname: "先生", role: "requester", location: [43.0409, 141.3709], lineUserId: "U-sensei", level: 1, clearArea: "entrance", soloMinutes: 15 });
    await memoryRepo.upsertBase({ id: "base-p-sensei", number: 66, requesterId: "p-sensei" });
    await announce({ date: DEMO_DATE, forecastCm: 20 });
    await ring();

    const answered = await answerRollcall("U-sensei", "rc:ans=no");
    expect(actionsOf(answered.at(-1)!).map((a) => (a as { data?: string }).data)).toEqual(["tip:ask", "tip:no"]);
    expect(t(await tipStart("U-sensei", "tip:ask"))).toContain("ひとことで送ってください");
    expect(t((await tipReceive("U-sensei", "重い雪は少しずつ、腰を落として"))!)).toContain("今朝の先生のコツ");
    expect(await tipReceive("U-sensei", "もう一回")).toBeNull(); // 待っていなければ受け取らない
    expect((await loadTips()).some((x) => x.participantId === "p-sensei")).toBe(true);

    // 2回目の点呼では聞かない（2週間は）
    const again = await answerRollcall("U-sensei", "rc:ans=no");
    expect(actionsOf(again.at(-1)!).some((a) => (a as { data?: string }).data === "tip:ask")).toBe(false);

    const s = await loadMorning();
    fillAnswers(s, await loadRoster(), 7);
    await saveMorning(s);
    await plan();
    const line = (await loadMorning()).teacherTip?.line;
    expect(line).toBe("重い雪は少しずつ、腰を落として");
    const card = MSG.goConfirmed(66, undefined, undefined, line)[1] as FlexMessage;
    expect(JSON.stringify(card.contents)).toContain("今朝の先生のコツ");
  });

  it("同じ人のコツは最新の5つまで", async () => {
    for (let i = 0; i < 8; i++) await addTip("p-many", `コツその${["一", "二", "三", "四", "五", "六", "七", "八"][i]}`, new Date(Date.UTC(2026, 11, 1, 0, i)));
    expect((await loadTips()).filter((x) => x.participantId === "p-many")).toHaveLength(5);
  });
});
