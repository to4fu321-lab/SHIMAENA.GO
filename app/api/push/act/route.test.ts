import { beforeEach, describe, expect, it, vi } from "vitest";

// 通知のボタンから答える（spec v1.31）: 誰かは cookie の本人だけで決める
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (jar.has(k) ? { value: jar.get(k) } : undefined),
  }),
}));

import { POST } from "./route";
import { listThread } from "@/lib/inbox/store";
import { DEMO_DATE } from "@/lib/morning/flow";
import { announce, ring } from "@/lib/morning/ops";
import { loadMorning } from "@/lib/morning/store";
import { memoryRepo } from "@/lib/repo";
import { signViewer, VIEWER_COOKIE } from "@/lib/viewer";

const post = (body: unknown) => POST(new Request("http://localhost/api/push/act", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));

describe("通知のボタンから答える /api/push/act", () => {
  beforeEach(async () => {
    for (const k of ["__shimaenaRepo", "__shimaenaMorning", "__shimaenaInbox"]) delete (globalThis as Record<string, unknown>)[k];
    jar.clear();
    await memoryRepo.upsertParticipant({
      id: "p-watch",
      nickname: "時計太郎",
      role: "helper",
      location: [43.0402, 141.3702],
      lineUserId: "U-watch",
      teamId: "lupinus",
      morningMinutes: 30,
      hasTools: true,
    });
  });

  it("ログインの印がなければ答えられない（401）", async () => {
    const r = await post({ data: "rc:ans=am", label: "朝" });
    expect(r.status).toBe(401);
  });

  it("点呼の答えが本人の隊長トークに入り、受け付けの文が返る", async () => {
    jar.set(VIEWER_COOKIE, signViewer("p-watch"));
    await announce({ date: DEMO_DATE, forecastCm: 12 });
    await ring();
    const r = await post({ data: "rc:ans=am", label: "朝（〜9時）" });
    expect(r.status).toBe(200);
    const j = (await r.json()) as { ok: boolean; text: string };
    expect(j.ok).toBe(true);
    expect(j.text.length).toBeGreaterThan(0);
    const mine = (await listThread("U-watch")).filter((x) => x.dir === "in");
    expect(mine.at(-1)?.body).toMatchObject({ text: "朝（〜9時）" }); // 押したボタンの文字が本人の吹き出しに
    const s = await loadMorning();
    expect(s.answers.find((a) => a.participantId === "p-watch")?.answer).toBeDefined(); // 「朝」は手伝う側の答えとして記録される
  });

  it("答え以外のボタン（地図を開く・登録の会話）は受け付けない（400）", async () => {
    jar.set(VIEWER_COOKIE, signViewer("p-watch"));
    expect((await post({ data: "go:yes" })).status).toBe(400);
    expect((await post({ data: "rc:ans=<script>" })).status).toBe(400);
    expect((await post("nonsense")).status).toBe(400);
  });
});
