// デモはいつでも「雪が積もった朝・頼む家がある」から始める（11/10 本人の指示）。
// /demo で人をえらんだときに呼ぶ。今日の作戦がもうあり、まだ終わっていない家があれば何もしない（ほかの人のデモを消さない）。
// なければ 12cm の雪の朝を作り直す（予告 → 6:30 → 作戦。Claude を待たない）。隊長トークに知らせるのは架空の人だけ。
import { demoEnabled } from "../env";
import { DEMO_PREFIX, inboxKeyOf } from "../inbox/key";
import { clearThread } from "../inbox/store";
import { jstDate } from "../jst";
import { withStateLock } from "../ops/lock";
import type { MorningRecord } from "./flow";
import { announce, plan, ring } from "./ops";
import { loadRoster } from "./roster";
import { loadMorning } from "./store";
import { appNow } from "@/lib/clock";

export const DEMO_SNOW_CM = 12;

/** 今日の作戦があって、まだ終わっていない家がある */
export function hasDemoWork(s: MorningRecord, today: string): boolean {
  const rc = s.morning.rollcall;
  return rc.status === "planned" && rc.date === today && s.morning.missions.some((m) => m.status !== "done");
}

/** 作り直したら true */
export async function ensureDemoMorning(now = appNow()): Promise<boolean> {
  if (!demoEnabled()) return false;
  const today = jstDate(now);
  if (hasDemoWork(await loadMorning(), today)) return false;
  return withStateLock("demo:start", async () => {
    if (hasDemoWork(await loadMorning(), today)) return false; // 同時に押した人が先に用意した
    const roster = await loadRoster();
    const fake = new Set(roster.participants.filter((p) => !p.lineUserId).map((p) => p.id));
    // 架空の人の隊長トークは空にしてから（前の朝の話が混ざらないように）。本物の人のトークには触れない
    for (const p of roster.participants) {
      const k = inboxKeyOf(p);
      if (k?.startsWith(DEMO_PREFIX)) await clearThread(k).catch(() => undefined);
    }
    await announce({ date: today, forecastCm: DEMO_SNOW_CM, fast: true, only: fake });
    await ring({ fast: true });
    // 人手不足の家のヘルプ通知（本物の人のスマホも鳴る）は送らない。地図の「あと○人で救える家」から行ける
    await plan({ fast: true, only: fake, helpBase: "-" });
    return true;
  });
}
