import { describe, expect, it } from "vitest";
import { sniffImageType } from "../image";
import { handleEvent } from "../line/handle";
import type { LineEvent, TextMessage } from "../line/types";
import { memoryRepo } from "../repo";
import { isDemoViewer, readViewer, signViewer } from "../viewer";
import { DEMO_DATE, fillAnswers } from "./flow";
import { announce, completeWithPhoto, plan, reportShort, ring, setGoing } from "./ops";
import { loadMorning, saveMorning } from "./store";
import { loadRoster } from "./roster";

// 吹き出しが分かれても読めるように、全部の文をつなげて調べる
const t = (m: { type: string } | { type: string }[]) => [m].flat().map((x) => (x as TextMessage).text ?? "").join("\n");
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);

describe("画像の種類と画面の持ち主の印", () => {
  it("先頭のバイトで JPEG・PNG・WebP を見分ける", () => {
    expect(sniffImageType(JPEG)).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe("image/webp");
    expect(sniffImageType(new Uint8Array([1, 2, 3]))).toBeUndefined();
  });
  it("署名つきの印は書き換えると読めない", () => {
    const v = signViewer("p-abc");
    expect(readViewer(v)).toBe("p-abc");
    expect(readViewer(v.replace("p-abc", "p-xyz"))).toBeUndefined();
    expect(readViewer("p-abc")).toBeUndefined();
    expect(readViewer(undefined)).toBeUndefined();
    expect(isDemoViewer("h3")).toBe(true);
    expect(isDemoViewer("p-abc")).toBe(false);
  });
});

async function morningWithPlan() {
  await memoryRepo.upsertParticipant({
    id: "p-go",
    nickname: "ゴー子",
    role: "helper",
    location: [43.0403, 141.3703],
    lineUserId: "U-go",
    teamId: "marigold",
    morningMinutes: 60,
    hasTools: true,
  });
  await announce({ date: DEMO_DATE, forecastCm: 12 });
  await ring();
  const s = await loadMorning();
  fillAnswers(s, await loadRoster(), 3);
  s.answers.push({ rollcallId: s.morning.rollcall.id, participantId: "p-go", answer: 60, answeredAt: "2026-12-14T06:31:00+09:00" });
  await saveMorning(s);
  await plan();
  return loadMorning();
}

describe("朝の一本道（行く → 写真 → 完了 → 得点 → 通知）", () => {
  it("割り当てのある人が「行く」→ 写真で完了 → 家の全員が完了になり得点が入る", async () => {
    const s = await morningWithPlan();
    const mine = s.morning.sorties.find((x) => x.participantId === "p-go");
    expect(mine).toBeDefined();
    const mission = s.morning.missions.find((m) => m.id === mine!.missionId)!;
    const mates = s.morning.sorties.filter((x) => x.missionId === mission.id);

    expect(t((await setGoing("p-go", true)))).toContain("了解");
    let now = await loadMorning();
    expect(now.morning.sorties.find((x) => x.participantId === "p-go")?.confirmedAt).toBeTruthy();
    if (mission.status === "assigned") expect(now.morning.missions.find((m) => m.id === mission.id)?.status).toBe("in_progress");

    const before = now.morning.scores.length;
    const r = await completeWithPhoto("p-go", { bytes: JPEG, mediaType: "image/jpeg" }, new Date("2026-12-14T07:20:00+09:00"));
    expect(r.done).toBe(true);
    expect(t(r.messages)).toContain("完了");
    now = await loadMorning();
    const m = now.morning.missions.find((x) => x.id === mission.id)!;
    expect(m.status).toBe("done");
    for (const x of now.morning.sorties.filter((x) => x.missionId === mission.id)) {
      expect(x.status).toBe("done");
      expect(x.completedAt).toBe("2026-12-13T22:20:00.000Z");
    }
    expect(now.morning.scores.length).toBeGreaterThan(before);
    // 完了点は来た人数ぶん、7:30 前なので早朝点も付く
    const done = now.morning.scores.filter((e) => e.reason === "mission_done" && mates.some((x) => x.participantId === e.participantId));
    expect(done.length).toBe(mates.length);
    expect(now.morning.scores.some((e) => e.reason === "early" && e.participantId === "p-go")).toBe(true);

    // 2回目の写真は「割り当てなし」
    const again = await completeWithPhoto("p-go", { bytes: JPEG, mediaType: "image/jpeg" });
    expect(again.done).toBe(false);
    expect(t(again.messages)).toContain("割り当てはありません");
  });

  it("「今朝は行けない」で外れ、足りなくなった家は人手不足になる。「人手が足りない」も同じ", async () => {
    const s = await morningWithPlan();
    const mine = s.morning.sorties.find((x) => x.participantId === "p-go")!;
    const mission = s.morning.missions.find((m) => m.id === mine.missionId)!;
    expect(t((await setGoing("p-go", false)))).toContain("無理しないで");
    let now = await loadMorning();
    expect(now.morning.sorties.some((x) => x.participantId === "p-go")).toBe(false);
    const going = now.morning.sorties.filter((x) => x.missionId === mission.id).length;
    if (going < mission.requiredPeople) expect(now.morning.missions.find((m) => m.id === mission.id)?.status).toBe("short");

    // 割り当てがない人の「人手が足りない」は案内だけ
    expect(t((await reportShort("p-go")))).toContain("割り当てはありません");
    // 割り当てのある架空の人が押すと人手不足になる
    const other = now.morning.sorties.find((x) => x.status === "going")!;
    expect(t((await reportShort(other.participantId)))).toContain("人手不足");
    now = await loadMorning();
    expect(now.morning.missions.find((m) => m.id === other.missionId)?.status).toBe("short");
  });

  it("LINE から: 「行く」ボタンと写真メッセージ（鍵がないので写真の中身は取れず、受け取れない旨を返す）", async () => {
    await morningWithPlan();
    const ev = (rest: Record<string, unknown>): LineEvent =>
      ({ replyToken: "rt", source: { type: "user", userId: "U-go" }, timestamp: 0, ...rest }) as LineEvent;
    await handleEvent(ev({ type: "postback", postback: { data: "go:yes" } }));
    expect((await loadMorning()).morning.sorties.find((x) => x.participantId === "p-go")?.confirmedAt).toBeTruthy();
    // 画像の中身は LINE の API から取る（トークンなし → 取れない）。落ちずに返事を作る
    await handleEvent(ev({ type: "message", message: { id: "img1", type: "image" } }));
    expect((await loadMorning()).morning.sorties.find((x) => x.participantId === "p-go")?.status).toBe("going");
    // 登録していない人の写真
    await handleEvent({ ...ev({ type: "message", message: { id: "img2", type: "image" } }), source: { type: "user", userId: "U-none" } } as LineEvent);
  });
});
