import { describe, expect, it } from "vitest";
import { checkAnswerText, houseLine, normalizeDigits, safeText, type VerifyContext } from "./verify";

// 11/15 のレビューで起きた朝: 10軒のうち4軒完了、人手が足りない家は5軒。拠点6はあと1人、拠点7はいま0人であと3人
const ctx = (over: Partial<VerifyContext> = {}): VerifyContext => ({
  town: { houses: 10, done: 4, left: 6, short: 5, peopleOut: 7, snowCm: 12 },
  houses: [
    { missionId: "m6", number: 6, distanceM: 250, needMore: 1, status: "short" },
    { missionId: "m7", number: 7, distanceM: 150, needMore: 3, status: "short" },
    { missionId: "m9", number: 9, distanceM: 600, needMore: 0, status: "in_progress" },
  ],
  knownNumbers: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  weatherNumbers: [-3, 4, 12],
  ...over,
});
const m6 = ctx().houses[0];

describe("隊長の返事の点検（v1.59）", () => {
  it("レビューの返事（3軒・いちばん近いのは拠点7・あと1人、ボタンは拠点6）は、3つとも見つける", () => {
    const problems = checkAnswerText("人手が足りない家は3軒だしま〜。いちばん近いのは拠点7番、あと1人です。", ctx({ proposal: m6 }));
    expect(problems.join("\n")).toMatch(/人手が足りない家は 3軒ではなく 5軒/);
    expect(problems.join("\n")).toMatch(/拠点7は「あと1人」ではなく、あと3人/);
    expect(problems.join("\n")).toMatch(/本文は拠点7、ボタンは拠点6/);
  });

  it("事実どおりの返事は通す（全角・漢数字・約◯m のゆれも）", () => {
    expect(checkAnswerText("人手が足りない家は５軒です。拠点6まで約250m、あと1人だしま〜！", ctx({ proposal: m6 }))).toEqual([]);
    expect(checkAnswerText("終わった家は四軒、のこりは6軒。いちばん近い拠点7は150メートル、あと3人です。", ctx())).toEqual([]);
    expect(checkAnswerText("今朝の雪は12cm、気温は-3℃。長靴と手袋を忘れずにえな〜！もう1度見てね。", ctx())).toEqual([]);
    expect(checkAnswerText("あと1人で救える家が5軒あります。", ctx({ proposal: ctx().houses[1] }))).toEqual([]);
  });

  it("知らない番号・終わった家・合わない距離・いちばん近い・天気の数を見つける", () => {
    expect(checkAnswerText("拠点42へ行こう", ctx())[0]).toMatch(/拠点42は今朝の家にない/);
    expect(checkAnswerText("拠点3はあと1人です", ctx())[0]).toMatch(/もう終わっている/);
    expect(checkAnswerText("拠点6まで800m", ctx())[0]).toMatch(/約250m/);
    expect(checkAnswerText("いちばん近いのは拠点6です", ctx())[0]).toMatch(/拠点7/);
    expect(checkAnswerText("雪は30cm積もっています", ctx())[0]).toMatch(/天気の事実にない/);
    expect(checkAnswerText("町には8軒あります", ctx())[0]).toMatch(/どの数とも合わない/);
    expect(checkAnswerText("いま20人が活動中です", ctx())[0]).toMatch(/7人/);
  });

  it("落ちたときの文と家の1行は、同じデータからプログラムが組む", () => {
    expect(safeText(ctx({ proposal: m6 }))).toBe("今朝の家は 10軒、終わった家は 4軒、人手が足りない家は 5軒です。おすすめは拠点6。ここから約250m、あと1人。10分でも助かるしま〜！");
    expect(checkAnswerText(safeText(ctx({ proposal: m6 })), ctx({ proposal: m6 }))).toEqual([]);
    expect(checkAnswerText(safeText(ctx()), ctx())).toEqual([]);
    expect(houseLine(m6)).toBe("📍 拠点6 ・ 約250m ・ あと1人");
    expect(safeText(ctx({ town: { houses: 0, done: 0, left: 0, short: 0, peopleOut: 0, snowCm: 0 }, houses: [] }))).toMatch(/呼びかけはありません/);
    expect(normalizeDigits("拠点七は三軒")).toBe("拠点7は3軒");
  });
});
