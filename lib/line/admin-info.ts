// 管理者ダッシュボード（/admin/settings）で見る LINE の状態。読むだけで、何も変えない。
// 通数（今月の送信数）は LINE の本当の数。トークンがなければ null。
const API = "https://api.line.me/v2/bot";

export interface LineAdminInfo {
  botName: string | null;
  /** 今月の上限（none なら上限なし） */
  quota: number | "none" | null;
  /** 今月これまでに送った数（LINE の実数） */
  used: number | null;
  webhook: { endpoint: string; active: boolean } | null;
}

async function getJson<T>(path: string, token: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export async function lineAdminInfo(): Promise<LineAdminInfo | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  const [info, quota, used, webhook] = await Promise.all([
    getJson<{ displayName?: string }>("/info", token),
    getJson<{ type?: string; value?: number }>("/message/quota", token),
    getJson<{ totalUsage?: number }>("/message/quota/consumption", token),
    getJson<{ endpoint?: string; active?: boolean }>("/channel/webhook/endpoint", token),
  ]);
  return {
    botName: info?.displayName ?? null,
    quota: quota ? (quota.type === "limited" ? (quota.value ?? null) : "none") : null,
    used: used?.totalUsage ?? null,
    webhook: webhook?.endpoint ? { endpoint: webhook.endpoint, active: Boolean(webhook.active) } : null,
  };
}
