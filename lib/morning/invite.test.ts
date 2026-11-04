// あなたが主役の招待文（spec v1.6）: 完了した本人に3案。名前・拠点・作った数字は入れない
import { describe, expect, it } from "vitest";
import { inviteOk, mockInvites } from "../claude/invite";
import { actionsOf } from "../line/flex";
import { DEMO_DATE, fillAnswers } from "./flow";
import { withInvites } from "./clear";
import { announce, completeWithPhoto, plan, ring } from "./ops";
import { loadRoster } from "./roster";
import { loadMorning, saveMorning } from "./store";

describe("招待文", () => {
  it("定型は3案で、名前・拠点・作った数字がない", () => {
    const d = mockInvites({ minutes: 15, firstTime: true, snowCm: 12, snowName: "ぼた雪のドンブリ" });
    expect(d).toHaveLength(3);
    for (const x of d) expect(inviteOk(x, [15, 12, 1, 10])).toBe(true);
    expect(inviteOk("佐藤さんの家に行ったよ", [])).toBe(false);
    expect(inviteOk("拠点3の雪かき、一緒にどう？", [3])).toBe(false);
    expect(inviteOk("今朝は100人で雪かきした！一緒にどう？", [15])).toBe(false);
  });

  it("写真で完了した本人に3案が残り、LINE の返事に「友だちを誘う」、完了画面にも出る", async () => {
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    const s = await loadMorning();
    fillAnswers(s, await loadRoster(), 7);
    await saveMorning(s);
    await plan();
    const going = (await loadMorning()).morning.sorties.find((x) => x.status === "going")!;
    const r = await completeWithPhoto(going.participantId, { bytes: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg" });
    expect(r.done).toBe(true);
    const invite = actionsOf(r.messages.at(-1)!).find((a) => a.label === "友だちを誘う");
    expect(invite && "uri" in invite && invite.uri).toMatch(/^https:\/\/line\.me\/R\/share\?text=/);
    const saved = (await loadMorning()).invites?.[going.participantId];
    expect(saved).toHaveLength(3);
    expect(r.clear?.invites).toEqual(saved); // 写真を送った本人の完了画面に出る
    expect(withInvites({ ...r.clear!, mine: true }, saved)?.invites).toEqual(saved);
    expect(withInvites({ ...r.clear!, mine: false, invites: undefined }, saved)?.invites).toBeUndefined(); // 他の人の完了には出さない
  });
});
