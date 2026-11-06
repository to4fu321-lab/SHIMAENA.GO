import { describe, expect, it, vi } from "vitest";
import { textOf } from "../line/flex";

const script: unknown[][] = [];
const create = vi.fn(async () => {
  const content = script.shift() ?? [];
  return { stop_reason: "tool_use", content };
});
vi.mock("../claude/client", async (orig) => ({
  ...(await orig<typeof import("../claude/client")>()),
  hasClaudeKey: () => true,
  getClaudeClient: () => ({ beta: { messages: { create } } }),
}));

const NOW = new Date("2026-12-14T07:30:00+09:00");

describe("隊長エージェント（v1.25）", () => {
  it("道具で町と近くの家を調べてから、人手不足の家を1つ提案し、ボタンは決まった処理（help:go）", async () => {
    const { captainAgent, runTool } = await import("./captain");
    const { repo } = await import("../repo");
    const me = (await repo().findParticipant("h10"))!;
    const houses = JSON.parse(await runTool("find_houses", {}, me, NOW)) as { houses: { missionId: string; number: number; needMore: number; distanceM: number }[] };
    expect(houses.houses.length).toBeGreaterThan(0);
    expect(JSON.stringify(houses)).not.toMatch(/さん/); // 名前は出さない
    const target = houses.houses.find((h) => h.needMore > 0) ?? houses.houses[0];
    script.push(
      [{ type: "tool_use", id: "t1", name: "look_town", input: {} }, { type: "tool_use", id: "t2", name: "check_weather", input: {} }],
      [{ type: "tool_use", id: "t3", name: "find_houses", input: { maxDistanceM: 800 } }],
      [{ type: "tool_use", id: "t4", name: "answer", input: { text: `拠点${target.number}があと${target.needMore}人です。${target.distanceM}m先だしま〜！`, kind: "join_house", missionId: target.missionId, button: "この家へ行く", why: "いちばん人手が足りない家" } }],
    );
    const r = await captainAgent(me, "30分あいてるよ", NOW);
    expect(r.used).toEqual(["look_town", "check_weather", "find_houses"]);
    expect(textOf(r.messages[0])).toContain(`拠点${target.number}`);
    expect(JSON.stringify(r.messages)).toContain("隊長が調べたこと: 🗺 町の様子 ・ ☁ 天気と安全 ・ 🏠 近くの家");
    expect(JSON.stringify(r.messages)).toContain(`help:go=${target.missionId}`);
  });

  it("候補にない提案・夜の家の提案はボタンにしない", async () => {
    const { renderAnswer } = await import("./captain");
    const { repo } = await import("../repo");
    const me = (await repo().findParticipant("h10"))!;
    const fake = await renderAnswer(me, { text: "x", kind: "activity", activityId: "launch_rocket" }, [], NOW);
    expect(JSON.stringify(fake)).not.toContain("postback");
    const night = await renderAnswer(me, { text: "x", kind: "join_house", missionId: "m3" }, [], new Date("2026-12-14T21:00:00+09:00"));
    expect(JSON.stringify(night)).not.toContain("help:go");
  });

  it("指示の最初に役割とチームの有無。チームのない人には家の提案をさせない", async () => {
    const { whoLine } = await import("./captain");
    const { TEAMS } = await import("../teams");
    expect(whoLine({ role: "helper", teamId: TEAMS[0].id })).toContain(`手伝う側・${TEAMS[0].name}チーム`);
    const none = whoLine({ role: "requester", teamId: undefined });
    expect(none).toContain("お願いする側");
    expect(none).toContain("join_house");
  });

  it("直近のやり取りの末尾が今回の文なら落とす（2回渡さない）", async () => {
    const { talkLines } = await import("./captain");
    const items = [
      { dir: "out", body: { type: "text", text: "おはよう" } },
      { dir: "in", body: { type: "text", text: "じゃあ行くよ" } },
    ];
    expect(talkLines(items, "じゃあ行くよ")).toBe("隊長: おはよう");
    expect(talkLines(items, "別の文")).toBe("隊長: おはよう\n本人: じゃあ行くよ");
  });
});
