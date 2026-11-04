// 仲間を増やす仕掛け（spec v1.8）: 招待リンクに「誰からの招待か」の印（招待コード）を付け、誘った結果を本人に返す。
// コードは参加者 ID から作る短い印で、コードから ID や名前は分からない（HMAC）。
// 数えるのは「招待リンクを開いた人」と「そこから町を応援した人」だけ。LINE の友だち追加は印を引き継げないので、登録までは数えない（そう表示する）。
// 報酬は付けない（spec v1.3「招待の数で報酬は付けない」）。
import { createHmac } from "node:crypto";
import { hasDb, query } from "./db";
import { baseUrl } from "./url";

export const INVITE_COOKIE = "shimaena_inv";
const CODE = /^[A-Za-z0-9_-]{8}$/;

function secret(): string {
  return process.env.LINE_CHANNEL_SECRET || "shimaena-invite";
}

export function inviteCode(participantId: string): string {
  return createHmac("sha256", secret()).update(`invite:${participantId}`).digest("base64url").slice(0, 8);
}

export function isInviteCode(s: string | undefined | null): s is string {
  return Boolean(s && CODE.test(s));
}

/** 招待リンク（開くと町の公開ページ。「友だちからの招待」と、町を応援する・LINE で参加する） */
export function inviteUrl(participantId: string): string {
  return `${baseUrl()}/public/town?via=invite&r=${inviteCode(participantId)}`;
}

export interface InviteStats {
  opens: number;
  cheers: number;
}

const g = globalThis as { __shimaenaInvites?: Map<string, InviteStats> };
const mem = () => (g.__shimaenaInvites ??= new Map());

async function bump(code: string, field: keyof InviteStats): Promise<void> {
  if (!isInviteCode(code)) return;
  const cur = mem().get(code) ?? { opens: 0, cheers: 0 };
  mem().set(code, { ...cur, [field]: cur[field] + 1 });
  if (!hasDb()) return;
  try {
    await query(
      `insert into morning_state (key, state, updated_at) values ($1, jsonb_build_object('opens', 0, 'cheers', 0) || jsonb_build_object($2::text, 1), now())
       on conflict (key) do update set updated_at = now(),
         state = morning_state.state || jsonb_build_object($2::text, coalesce((morning_state.state->>$2)::int, 0) + 1)`,
      [`invite:${code}`, field],
    );
  } catch (e) {
    console.error("[invite] 数えられませんでした:", e instanceof Error ? e.message : e);
  }
}

export const recordInviteOpen = (code: string) => bump(code, "opens");
export const recordInviteCheer = (code: string) => bump(code, "cheers");

export async function readInviteStats(participantId: string): Promise<InviteStats> {
  const code = inviteCode(participantId);
  if (hasDb()) {
    try {
      const rows = await query<{ state: Partial<InviteStats> }>("select state from morning_state where key = $1", [`invite:${code}`]);
      const s = rows[0]?.state;
      return { opens: Number(s?.opens ?? 0), cheers: Number(s?.cheers ?? 0) };
    } catch (e) {
      console.error("[invite] 読めませんでした:", e instanceof Error ? e.message : e);
    }
  }
  return { ...(mem().get(code) ?? { opens: 0, cheers: 0 }) };
}

/** 誘った結果のひとこと（0 なら出さない） */
export function inviteResultLine(s: InviteStats): string | undefined {
  if (s.opens <= 0 && s.cheers <= 0) return undefined;
  const parts = [s.opens > 0 && `${s.opens}人が見てくれて`, s.cheers > 0 && `${s.cheers}人が町を応援してくれました`].filter(Boolean);
  const text = parts.join("、");
  return `あなたの誘いで、${text.endsWith("くれて") ? `${text}います` : text}。`;
}
