// 報告箱（spec v1.33）と GitHub Actions の橋わたし（.github/workflows/feedback.yml が1時間ごとに呼ぶ）。鍵は Vercel の CRON_SECRET（Cron と同じ）。
//   GET  … まだ Issue のない報告（題・本文。本文は個人情報を除いたもの）
//   POST { op: "issued", id, number, url } … Issue を立てたと知らせる
//   POST { op: "sync" } … 閉じた Issue を見て、本人の隊長トークに「直しました」を届ける
import { attachIssue, pendingForBridge, syncWithGithub } from "@/lib/feedback/ops";

function authorized(req: Request): Response | undefined {
  const secret = process.env.CRON_SECRET;
  if (!secret) return new Response("CRON_SECRET がありません（Vercel の環境変数に入れてください）", { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  return undefined;
}

export async function GET(req: Request): Promise<Response> {
  const denied = authorized(req);
  if (denied) return denied;
  return Response.json({ ok: true, reports: await pendingForBridge() });
}

export async function POST(req: Request): Promise<Response> {
  const denied = authorized(req);
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { op?: string; id?: string; number?: number; url?: string };
  if (body.op === "issued") {
    const ok = typeof body.id === "string" && (await attachIssue(body.id, Number(body.number), String(body.url ?? "")));
    return Response.json({ ok }, { status: ok ? 200 : 400 });
  }
  if (body.op === "sync") return Response.json({ ok: true, ...(await syncWithGithub({ force: true })) });
  return Response.json({ ok: false, error: "op は issued か sync" }, { status: 400 });
}
