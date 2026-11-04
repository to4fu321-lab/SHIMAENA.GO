// ことばで答える・頼む（spec v1.6）: 自由な文 → 点呼の答えと段取り。キーなしは言葉の一覧
import { describe, expect, it } from "vitest";
import { mockWords, tidyWords } from "../claude/words";
import { textOf } from "../line/flex";
import { MSG } from "../line/messages";
import type { FlexMessage, LineMessage } from "../line/types";
import { memoryRepo } from "../repo";
import { requestLabel } from "../request-note";
import { DEMO_DATE, fillAnswers } from "./flow";
import { announce, answerByWords, plan, ring } from "./ops";
import { loadRoster } from "./roster";
import { loadMorning, saveMorning } from "./store";

const t = (m: LineMessage | LineMessage[]) => [m].flat().map(textOf).join("\n");

describe("ことばを読む（キーなしの言葉の一覧）", () => {
  it("予定の時刻ではなく「〜までに」を締め切りに、範囲も読む", () => {
    const w = mockWords({ text: "今日は10時に病院だから、9時までに玄関だけお願いできるかね", role: "requester" });
    expect(w).toMatchObject({ answer: "no", deadline: "09:00", area: "entrance" });
    expect(requestLabel({ deadline: w.deadline!, area: w.area! })).toBe("09:00 まで・玄関前");
  });

  it("来なくていい・一緒なら・分からない", () => {
    expect(mockWords({ text: "孫が来るから大丈夫だよ", role: "requester" }).answer).toBe("yes");
    expect(mockWords({ text: "一緒にならやれるよ", role: "requester" }).answer).toBe("together");
    const u = mockWords({ text: "こんにちは", role: "requester" });
    expect(u.answer).toBe("unknown");
    expect(u.askBack).toBeTruthy();
  });

  it("手伝う側は分に直す（言った分以下で近いもの）・休む", () => {
    expect(mockWords({ text: "20分なら行けます", role: "helper" }).answer).toBe("30");
    expect(mockWords({ text: "10分だけ", role: "helper" }).answer).toBe("15");
    expect(mockWords({ text: "今朝は無理です", role: "helper" }).answer).toBe("0");
  });

  it("手伝う人へのひとことに、体や病気のことばは出さない", () => {
    const w = tidyWords({ answer: "no", deadline: "9:00", area: "entrance", note: "腰が痛いので", askBack: null }, "requester");
    expect(w.note).toBeNull();
    expect(w.deadline).toBe("09:00");
  });
});

describe("LINE の流れ", () => {
  it("点呼の時間の文 → 答えと段取りが記録され、作戦のミッションと行き先カードに出る", async () => {
    await memoryRepo.upsertParticipant({ id: "p-words", nickname: "ことば花子", role: "requester", location: [43.0408, 141.3712], lineUserId: "U-words", level: 1, clearArea: "entrance", soloMinutes: 15 });
    await memoryRepo.upsertBase({ id: "base-p-words", number: 77, requesterId: "p-words" });

    await announce({ date: DEMO_DATE, forecastCm: 12 });
    expect(await answerByWords("U-words", "9時までに玄関だけお願い")).toBeNull(); // 点呼の前は読まない
    await ring();

    const ms = await answerByWords("U-words", "今日は10時に病院だから、9時までに玄関だけお願いできるかね");
    expect(t(ms!)).toContain("「09:00 まで・玄関前」で受け付けました");
    const s = await loadMorning();
    expect(s.answers.find((a) => a.participantId === "p-words")).toMatchObject({ answer: "no", request: { deadline: "09:00", area: "entrance" } });
    expect(JSON.stringify(s)).not.toContain("病院"); // 原文は残さない

    fillAnswers(s, await loadRoster(), 7);
    await saveMorning(s);
    await plan();
    const m = (await loadMorning()).morning.missions.find((x) => x.baseId === "base-p-words");
    expect(m?.request).toEqual({ deadline: "09:00", area: "entrance" });

    const card = MSG.goConfirmed(77, undefined, m!.request)[1] as FlexMessage;
    expect(JSON.stringify(card.contents)).toContain("お願い: 09:00 まで・玄関前");
  });

  it("分からない文は聞き返して、ボタンの質問をもう一度出す", async () => {
    const ms = await answerByWords("U-words", "こんにちは");
    expect(ms).not.toBeNull();
    expect(t(ms!)).toContain("来てほしいですか");
  });
});
