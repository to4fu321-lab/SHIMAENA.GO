// Vercel Cron の入口（vercel.json）。CRON_SECRET を Vercel の環境変数に入れると、Vercel が Authorization に付けて呼んでくる。
//   announce: 前夜 21:00 JST — Open-Meteo を見て予告
//   rollcall: 6:30 JST — 10cm 以上積もっていたら、登録した家を雪かき待ちにして近所へお知らせ（spec v1.20。その前に、夜に届いた道の報告を近くの人へ）
//   plan:     6:40 JST — 作戦配信（Hobby プランの cron は2本までなので、GitHub Actions の .github/workflows/plan.yml から呼ぶ。答えが届いた時の planIfDue は予備）
//   noon / pm: 11:30・16:30 JST — お昼・夕方の出番（降り続いていれば終わった家を開き直し、その時間に動ける人へ）。.github/workflows/later.yml から
//   weekly:   日曜の「今週の群れ」（announce が日曜なら先に行う。単独で呼ぶ用）
import { checkForecastAndAnnounce, laterShift, morningAuto, plan, weeklyRecap } from "@/lib/morning/ops";
import { withStateLock } from "@/lib/ops/lock";
import { recordProblem } from "@/lib/ops/problems";
import { nudgeInactive } from "@/lib/nudge/ops";
import { flushRoadAlerts } from "@/lib/road/notify";
import { firstStormNotice, STORM_LINES, stormHeadline, stormStatus } from "@/lib/storm";
import { loadRoster, lineIds } from "@/lib/morning/roster";
import { multicast } from "@/lib/line/client";
import { MSG } from "@/lib/line/messages";
import { jstDate } from "@/lib/jst";
import { warmDayTopic } from "@/lib/topic/day";

/** 警報で止める仕事（週のまとめは止めない） */
const STORM_JOBS = new Set(["announce", "rollcall", "plan", "noon", "pm"]);

export async function GET(req: Request, ctx: { params: Promise<{ job: string }> }): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET がありません（Vercel の環境変数に入れてください）", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

  const { job } = await ctx.params;
  return withStateLock(`cron:${job}`, () => run(job));
}

async function run(job: string): Promise<Response> {
  try {
    // 警報の日はお休み（spec v1.11）: 予告・点呼・作戦・お昼／夕方の出番を送らず、全員にお休みを1日1回だけ知らせる
    if (STORM_JOBS.has(job)) {
      const storm = await stormStatus();
      if (storm.stopped) {
        let notified = 0;
        if (await firstStormNotice(jstDate())) {
          const ids = lineIds((await loadRoster()).participants);
          if (await multicast(ids, MSG.stormStop(stormHeadline(storm), STORM_LINES))) notified = ids.length;
        }
        return Response.json({ ok: true, job, stopped: true, warnings: storm.names, notified });
      }
    }
    switch (job) {
      case "announce": {
        const r = await checkForecastAndAnnounce();
        return Response.json({ ok: true, job, ...r });
      }
      case "rollcall": {
        // 夜のあいだに届いた道の報告を、近くの人へまとめて知らせる（失敗しても点呼は進める）
        const road = await flushRoadAlerts().catch(async (e) => {
          await recordProblem("cron/road", e);
          return 0;
        });
        const r = await morningAuto();
        // 今日の話題（spec v1.23）を朝のうちに調べておく（カードを作る時に待たせない）。失敗しても暦の話題で描ける
        const topic = await warmDayTopic(jstDate()).then((t) => t.by, async (e) => (await recordProblem("cron/topic", e), "calendar"));
        return Response.json({ ok: true, job, ...r, road, topic });
      }
      case "plan": {
        const r = await plan();
        return Response.json({ ok: true, job, status: r.record.morning.rollcall.status, sent: r.sent });
      }
      case "noon":
      case "pm": {
        const r = await laterShift(job);
        // 夕方の処理に乗せて、しばらく活動のない人へ隊長の声かけ（spec v1.18）。失敗しても出番の処理は返す
        const nudged = job === "pm" ? await nudgeInactive().catch(async (e) => (await recordProblem("cron/nudge", e), { checked: 0, sent: 0, names: [] })) : undefined;
        return Response.json({ ok: true, job, ...r, ...(nudged ? { nudged: nudged.sent } : {}) });
      }
      case "weekly": {
        const r = await weeklyRecap();
        return Response.json({ ok: true, job, days: r.summary.days, missionsDone: r.summary.missionsDone, sent: r.sent });
      }
      default:
        return new Response("知らない仕事です: " + job, { status: 404 });
    }
  } catch (e) {
    await recordProblem(`cron/${job}`, e);
    return Response.json({ ok: false, job, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
