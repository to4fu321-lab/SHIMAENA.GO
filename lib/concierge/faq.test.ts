// 隊長に相談とよくある質問・「出動する」を行き止まりにしない（spec v1.10）
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { handleEvent } from "../line/handle";
import { actionsOf, textOf } from "../line/flex";
import type { LineEvent, LineMessage } from "../line/types";
import { emptyMorning } from "../morning/flow";
import { saveMorning } from "../morning/store";
import { jstDate } from "../jst";
import { listThread } from "../inbox/store";
import { memoryRepo } from "../repo";
import type { Participant } from "../types";
import { faqKind, faqReply, snowLines } from "./faq";

const t = (ms: LineMessage[]) => ms.map(textOf).join("\n");
const me: Participant = { id: "p-faq", nickname: "相談子", role: "helper", location: [43.0401, 141.3699], lineUserId: "U-faq", teamId: "lupinus", morningMinutes: 30, hasTools: true };

beforeEach(() => {
  for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaArchive", "__shimaenaConcierge", "__shimaenaSoloScores", "__shimaenaInbox"]) delete (globalThis as Record<string, unknown>)[k];
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("よくある質問の読み分け", () => {
  it("メニューの文字・ボタンの文字を読み分ける。「何をすればいい？」はコンシェルジュへ回す", () => {
    expect(faqKind("隊長に相談")).toBe("start");
    expect(faqKind("相談")).toBe("start");
    expect(faqKind("今日の雪は？")).toBe("snow");
    expect(faqKind("チームの様子")).toBe("team");
    expect(faqKind("使い方")).toBe("guide");
    expect(faqKind("何をすればいい？")).toBeNull();
    expect(faqKind("10時に病院だから玄関だけ相談したい")).toBeNull();
  });
});

describe("答え", () => {
  it("相談の入口: 登録した人にはよくある質問のボタン、まだの人には登録", async () => {
    await memoryRepo.upsertParticipant(me);
    const yes = await faqReply("U-faq", "start");
    const labels = actionsOf(yes.at(-1)!).map((a) => ("label" in a ? a.label : ""));
    expect(labels).toEqual(expect.arrayContaining(["何をすればいい？", "今日の雪は？", "チームの様子", "使い方"]));
    const no = await faqReply("U-nobody", "start");
    expect(actionsOf(no.at(-1)!).map((a) => ("label" in a ? a.label : ""))).toContain("登録する");
  });

  it("雪のない日は今の天気と「予定なし」。数字は天気の答えだけ", async () => {
    await saveMorning(emptyMorning({ date: "2026-01-01", forecastCm: 0 }));
    const lines = await snowLines(new Date("2026-11-04T10:00:00+09:00"), { code: 3, tempC: 4.4 });
    expect(lines.join("")).toContain("くもりです（4℃）");
    expect(lines.join("")).toContain("予定はありません");
  });

  it("雪の朝は予報の cm と雪の名前", async () => {
    const now = new Date("2026-12-14T08:00:00+09:00");
    const s = emptyMorning({ date: jstDate(now), forecastCm: 12, snowName: "わた雪" });
    s.morning.rollcall.status = "planned";
    await saveMorning(s);
    expect((await snowLines(now, {})).join("")).toContain("12cm の予報です（わた雪）");
  });

  it("チーム: チームがあればチームの画面へ", async () => {
    await memoryRepo.upsertParticipant(me);
    const ms = await faqReply("U-faq", "team");
    expect(actionsOf(ms.at(-1)!).some((a) => a.type === "uri" && a.uri.includes("/team"))).toBe(true);
  });
});

describe("LINE の流れ", () => {
  const ev = (rest: Record<string, unknown>): LineEvent => ({ replyToken: "rt", source: { type: "user", userId: "U-faq" }, timestamp: 0, ...rest }) as LineEvent;
  /** 隊長トークに入った返事（文面の JSON をつなげたもの） */
  const said = async () => (await listThread("U-faq")).filter((x) => x.dir === "out").map((x) => JSON.stringify(x.body)).join("\n");

  it("「出動する」で手伝える家がない日は、何分？を聞かずに隊長のおすすめ（画像とボタン）", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-04T10:00:00+09:00"));
    await memoryRepo.upsertParticipant(me);
    await saveMorning(emptyMorning({ date: "2026-01-01", forecastCm: 0 }));
    await handleEvent(ev({ type: "message", message: { id: "1", type: "text", text: "出動する" } }));
    const out = await said();
    expect(out).toContain("今は近くに手伝える家はありません");
    expect(out).toContain("you.png");
    expect(out).not.toContain("何分動けますか");
  });

  it.each(["雪かきGO！", "雪かきGO", "雪かきｇｏ!"])("「%s」でも「出動する」と同じに動く（ボタンの名前を変えた・前の名前も受け付ける）", async (text) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-04T10:00:00+09:00"));
    await memoryRepo.upsertParticipant(me);
    await saveMorning(emptyMorning({ date: "2026-01-01", forecastCm: 0 }));
    await handleEvent(ev({ type: "message", message: { id: "3", type: "text", text } }));
    expect(await said()).toContain("今は近くに手伝える家はありません");
  });

  it("「隊長に相談」でよくある質問のボタン", async () => {
    await memoryRepo.upsertParticipant(me);
    await handleEvent(ev({ type: "message", message: { id: "2", type: "text", text: "隊長に相談" } }));
    expect(await said()).toContain("何をすればいい？");
    expect(t(await faqReply("U-faq", "guide"))).toContain("使い方");
  });
});
