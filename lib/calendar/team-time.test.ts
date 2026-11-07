import { describe, expect, it } from "vitest";
import { emptyMorning } from "../morning/flow";
import { TOWN_ROSTER } from "../morning/roster";
import { onTeam } from "../member";
import { teamTimeView, timeActive, wishesFor } from "./team-time";

describe("そろう時間の画面（spec v1.41）", () => {
  const me = TOWN_ROSTER.participants.find((p) => p.role === "helper" && p.teamId)!;
  const mates = TOWN_ROSTER.participants.filter((p) => onTeam(p) && p.teamId === me.teamId && p.id !== me.id);

  it("選べるのは、前夜の予告のあと〜その日（閉じた日・過ぎた日はだめ）", () => {
    const now = new Date("2026-11-08T12:00:00+09:00");
    expect(timeActive(emptyMorning({ date: "2026-11-09" }), now)).toBe(true); // 明日の予告
    const closed = emptyMorning({ date: "2026-11-08" });
    closed.morning.rollcall.status = "closed";
    expect(timeActive(closed, now)).toBe(false);
    expect(timeActive(emptyMorning({ date: "2026-11-07" }), now)).toBe(false); // きのう
    expect(timeActive(emptyMorning({ date: "2026-12-14" }), now)).toBe(true); // デモの朝
  });

  it("本番（デモでない）は、選んだ人だけを数える。そろう時間に決まった文が出る", () => {
    const s = emptyMorning({ date: "2026-12-14" });
    s.timeWishes = [
      { participantId: mates[0].id, when: "noon", at: "" },
      { participantId: mates[1].id, when: "noon", at: "" },
      { participantId: me.id, when: "am", at: "" },
    ];
    const v = teamTimeView(s, TOWN_ROSTER, me, { demo: false })!;
    expect(v.slots.map((x) => x.count)).toEqual([1, 2, 0]);
    expect(v.best).toBe("noon");
    expect(v.mine).toBe("am");
    expect(v.line).toContain("お昼");
    expect(v.dayLabel).toBe("今日");
  });

  it("隊長の一文（Claude）は、そろう時間と人数が今と同じときだけ使う", () => {
    const s = emptyMorning({ date: "2026-12-14" });
    s.timeWishes = [{ participantId: mates[0].id, when: "am", at: "" }];
    s.slotLines = { [me.teamId!]: { when: "am", count: 1, text: "朝 7:00〜に1人！一緒にどう？" } };
    expect(teamTimeView(s, TOWN_ROSTER, me, { demo: false })!.line).toBe("朝 7:00〜に1人！一緒にどう？");
    s.timeWishes.push({ participantId: mates[1].id, when: "am", at: "" });
    expect(teamTimeView(s, TOWN_ROSTER, me, { demo: false })!.line).not.toBe("朝 7:00〜に1人！一緒にどう？");
  });

  it("デモは架空の手伝う人が選んだことにする。見ている本人と、もう選んだ人は足さない", () => {
    const s = emptyMorning({ date: "2026-12-14" });
    s.timeWishes = [{ participantId: mates[0].id, when: "pm", at: "" }];
    const all = wishesFor(s, TOWN_ROSTER, me.id, true);
    expect(all.some((w) => w.participantId === me.id)).toBe(false);
    expect(all.filter((w) => w.participantId === mates[0].id)).toEqual([{ participantId: mates[0].id, when: "pm", at: "" }]);
    expect(wishesFor(s, TOWN_ROSTER, me.id, false)).toHaveLength(1);
    const v = teamTimeView(s, TOWN_ROSTER, me, { demo: true })!;
    expect(v.best).toBeDefined();
    expect(v.mine).toBeUndefined();
  });
});
