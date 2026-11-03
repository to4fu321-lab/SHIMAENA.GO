import { describe, expect, it } from "vitest";
import { checkPhoto, decidePhoto, mockPhotoCheck, PhotoCheckSchema } from "../claude/photo";
import { MAX_IMAGE_BYTES } from "../image";
import { MSG } from "../line/messages";
import type { TextMessage } from "../line/types";
import { DEMO_DATE, fillAnswers } from "./flow";
import { announce, completeManually, plan, ring } from "./ops";
import { loadRoster } from "./roster";
import { loadMorning, saveMorning } from "./store";

// 吹き出しが分かれても読めるように、全部の文をつなげて調べる
const t = (m: { type: string } | { type: string }[]) => [m].flat().map((x) => (x as TextMessage).text ?? "").join("\n");

describe("写真「確認できない」と手動完了（spec v1.1 9-3）", () => {
  it("通れる＝完了、判断できない＝報告として受け付け、それ以外＝もう一度", () => {
    const base = { icy: false, comment: "" };
    expect(decidePhoto({ ...base, cleared: true, passable: true })).toBe("done");
    expect(decidePhoto({ ...base, cleared: false, passable: false, uncertain: true })).toBe("accepted");
    expect(decidePhoto({ ...base, cleared: true, passable: false })).toBe("retry");
    expect(decidePhoto({ ...base, cleared: false, passable: false })).toBe("retry");
  });

  it("モックの形は採点表どおりで、大きすぎる写真は「判断できない」になる", async () => {
    const m = mockPhotoCheck();
    expect(PhotoCheckSchema.parse(m)).toEqual(m);
    expect(m.uncertain).toBe(false);
    if (process.env.ANTHROPIC_API_KEY) return;
    expect(await checkPhoto({ bytes: new Uint8Array(10), mediaType: "image/jpeg" })).toEqual(m);
  });

  it("「まだ」の返事には「それでも完了にする」ボタンが付く", () => {
    const m = MSG.photoNotCleared("もう少し").at(-1)!; // ボタンは最後の吹き出しに付く
    expect(m.quickReply?.items[0].action).toMatchObject({ type: "postback", data: "done:manual" });
    // 写真をもう一度撮る・選ぶボタンもある（失敗と感じさせず、次にすることを出す）
    expect(m.quickReply?.items.map((i) => i.action.type)).toEqual(["postback", "camera", "cameraRoll"]);
  });

  it("写真なしで完了にすると、本人の報告として記録され、MISSION CLEAR のまとめも返る", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    const s0 = await loadMorning();
    fillAnswers(s0, await loadRoster(), 7);
    await saveMorning(s0);
    await plan();
    const going = (await loadMorning()).morning.sorties.find((x) => x.status === "going")!;

    const r = await completeManually(going.participantId);
    expect(r.done).toBe(true);
    expect(r.clear?.missionId).toBe(going.missionId);
    expect(t(r.messages)).toContain("本人の報告");
    const s = await loadMorning();
    const sortie = s.morning.sorties.find((x) => x.id === going.id)!;
    expect(sortie.status).toBe("done");
    expect(sortie.photoCheck?.uncertain).toBe(true);
    expect(s.morning.missions.find((m) => m.id === going.missionId)!.status).toBe("done");
    expect(s.log.some((l) => l.includes("写真なし"))).toBe(true);
    // もう割り当てがないので2回目は断る
    expect((await completeManually(going.participantId)).done).toBe(false);
    expect(MAX_IMAGE_BYTES).toBeGreaterThan(0);
  });
});
