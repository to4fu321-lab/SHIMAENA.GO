// 雪のない朝、前の雪かきが終わっていない家へ「まだ必要ですか？」（spec v1.71）
import { describe, expect, it } from "vitest";
import { listThread } from "../inbox/store";
import { textOf } from "../line/flex";
import { memoryRepo } from "../repo";
import { inWorld } from "../world";
import { requestDay } from "./flow";
import { answerLeftover, askLeftovers, askForHelpById } from "./ops";
import { loadRoster } from "./roster";
import { loadMorning, saveMorning } from "./store";

const DAY = new Date("2026-12-14T02:00:00Z"); // 日本時間 11:00
const NEXT = new Date("2026-12-15T02:00:00Z");

describe("前の雪かきの確認", () => {
  it("終わっていない家の人に1回だけ聞き、「まだ必要です」で今日の地図に出る。「もう大丈夫」ならそのまま", async () => {
    await inWorld("real", async () => {
      await memoryRepo.upsertParticipant({ id: "p-left", nickname: "のこり", role: "requester", location: [43.0401, 141.3701], lineUserId: "U-left", level: 2, clearArea: "entrance", helpStyle: "omakase" });
      await memoryRepo.upsertBase({ id: "base-p-left", number: 31, requesterId: "p-left" });
      await saveMorning(requestDay({ date: "2026-12-14" }));
      await askForHelpById("p-left", DAY);
      expect((await loadMorning()).morning.missions.map((m) => m.status)).toEqual(["short"]);

      // 次の日の朝（雪なし）
      const s = await loadMorning();
      const roster = await loadRoster();
      expect(await askLeftovers(s, roster, "2026-12-15")).toBe(1);
      expect(await askLeftovers(s, roster, "2026-12-15")).toBe(0); // 1日1回
      const asked = (await listThread("U-left")).filter((x) => x.dir === "out").map((x) => ("type" in x.body ? textOf(x.body) : "")).join("\n");
      expect(asked).toContain("12月14日の雪かきで");
      expect(asked).toContain("いまも雪かきは必要ですか");
      await saveMorning(s);

      // 他人は答えられない
      expect(JSON.stringify(await answerLeftover("U-other", "left:yes=base-p-left", NEXT))).toContain("登録");
      // もう大丈夫 → 地図はそのまま（今日の記録は作らない）
      await answerLeftover("U-left", "left:no=base-p-left", NEXT);
      expect((await loadMorning()).morning.rollcall.date).toBe("2026-12-14");
      // まだ必要です → 今日の記録で、地図に出る
      await answerLeftover("U-left", "left:yes=base-p-left", NEXT);
      const today = await loadMorning();
      expect(today.morning.rollcall.date).toBe("2026-12-15");
      expect(today.morning.missions.map((m) => m.baseId)).toEqual(["base-p-left"]);
    });
  });

  it("前の家が全部終わっていれば、聞かない", async () => {
    const s = requestDay({ date: "2026-12-14" });
    expect(await askLeftovers(s, { participants: [], bases: [] }, "2026-12-15")).toBe(0);
  });
});
