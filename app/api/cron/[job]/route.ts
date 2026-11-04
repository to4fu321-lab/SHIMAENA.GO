// Vercel Cron の入口（vercel.json）。CRON_SECRET を Vercel の環境変数に入れると、Vercel が Authorization に付けて呼んでくる。
//   announce: 前夜 21:00 JST — Open-Meteo を見て予告
//   rollcall: 6:30 JST — 点呼
//   plan:     6:40 JST — 作戦配信（Hobby プランの cron は2本までなので、GitHub Actions の .github/workflows/plan.yml から呼ぶ。答えが届いた時の planIfDue は予備）
//   weekly:   日曜の「今週の群れ」（announce が日曜なら先に行う。単独で呼ぶ用）
import { checkForecastAndAnnounce, plan, ring, weeklyRecap } from "@/lib/morning/ops";

export async function GET(req: Request, ctx: { params: Promise<{ job: string }> }): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET がありません（Vercel の環境変数に入れてください）", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });

  const { job } = await ctx.params;
  try {
    switch (job) {
      case "announce": {
        const r = await checkForecastAndAnnounce();
        return Response.json({ ok: true, job, ...r });
      }
      case "rollcall": {
        const r = await ring();
        return Response.json({ ok: true, job, status: r.record.morning.rollcall.status, sent: r.sent });
      }
      case "plan": {
        const r = await plan();
        return Response.json({ ok: true, job, status: r.record.morning.rollcall.status, sent: r.sent });
      }
      case "weekly": {
        const r = await weeklyRecap();
        return Response.json({ ok: true, job, days: r.summary.days, missionsDone: r.summary.missionsDone, sent: r.sent });
      }
      default:
        return new Response("知らない仕事です: " + job, { status: 404 });
    }
  } catch (e) {
    console.error(`[cron/${job}]`, e);
    return Response.json({ ok: false, job, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
