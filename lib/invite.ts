// 仲間を増やす仕掛け（spec v1.8）: 招待リンクに「誰からの招待か」の印（招待コード）を付け、誘った結果を本人に返す。
// コードは参加者 ID から作る短い印で、コードから ID や名前は分からない（HMAC）。
// 数えるのは「招待リンクを開いた人」「そこから町を応援した人」と、LINE の中で招待リンクを開いてから登録・初出動した「仲間」。
// v1.8（本人の判断「水増しはよい。参加者を増やす・敷居を下げるが最優先」）: 誘った人に羽（開いた +2・応援 +3・仲間の初出動 +20、上限なし）。
// 仲間が初出動したら、誘った人と誘われた人の二人に「ふたりの群れ」カード（チームの得点には入れない）。
import { createHmac, randomBytes } from "node:crypto";
import { hasDb, query } from "./db";
import { jstDate } from "./jst";
import { repo } from "./repo";
import { bonusLog } from "./solo/feathers";
import type { SoloBonusKind } from "./solo/missions";
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

/** 招待リンク（開くと町の公開ページ。「友だちからの招待」と、町を応援する・LINE で参加する）。作るときに「この印は誰のものか」を覚える */
export function inviteUrl(participantId: string): string {
  const code = inviteCode(participantId);
  void rememberOwner(code, participantId);
  return `${baseUrl()}/public/town?via=invite&r=${code}`;
}

export interface InviteStats {
  opens: number;
  cheers: number;
  /** 仲間になって初出動した人 */
  joined: number;
}

type InviteRow = InviteStats & { pid?: string };
const EMPTY: InviteRow = { opens: 0, cheers: 0, joined: 0 };
const g = globalThis as { __shimaenaInvites?: Map<string, InviteRow>; __shimaenaInvited?: Map<string, string> };
const mem = () => (g.__shimaenaInvites ??= new Map());
const invitedMem = () => (g.__shimaenaInvited ??= new Map());

async function readRow(code: string): Promise<InviteRow> {
  if (hasDb()) {
    try {
      const rows = await query<{ state: Partial<InviteRow> }>("select state from morning_state where key = $1", [`invite:${code}`]);
      const s = rows[0]?.state;
      if (s) return { opens: Number(s.opens ?? 0), cheers: Number(s.cheers ?? 0), joined: Number(s.joined ?? 0), ...(s.pid ? { pid: s.pid } : {}) };
    } catch (e) {
      console.error("[invite] 読めませんでした:", e instanceof Error ? e.message : e);
    }
  }
  return { ...(mem().get(code) ?? EMPTY) };
}

/** この印は誰のものか（招待リンクを作ったときに覚える） */
async function rememberOwner(code: string, pid: string): Promise<void> {
  const cur = mem().get(code) ?? EMPTY;
  if (cur.pid === pid) return;
  mem().set(code, { ...cur, pid });
  if (!hasDb()) return;
  try {
    await query(
      `insert into morning_state (key, state, updated_at) values ($1, jsonb_build_object('opens', 0, 'cheers', 0, 'joined', 0, 'pid', $2::text), now())
       on conflict (key) do update set updated_at = now(), state = morning_state.state || jsonb_build_object('pid', $2::text)`,
      [`invite:${code}`, pid],
    );
  } catch (e) {
    console.error("[invite] 印を覚えられませんでした:", e instanceof Error ? e.message : e);
  }
}

async function bump(code: string, field: keyof InviteStats): Promise<string | undefined> {
  if (!isInviteCode(code)) return undefined;
  const cur = mem().get(code) ?? EMPTY;
  mem().set(code, { ...cur, [field]: cur[field] + 1 });
  if (hasDb()) {
    try {
      await query(
        `insert into morning_state (key, state, updated_at) values ($1, jsonb_build_object('opens', 0, 'cheers', 0, 'joined', 0) || jsonb_build_object($2::text, 1), now())
         on conflict (key) do update set updated_at = now(),
           state = morning_state.state || jsonb_build_object($2::text, coalesce((morning_state.state->>$2)::int, 0) + 1)`,
        [`invite:${code}`, field],
      );
    } catch (e) {
      console.error("[invite] 数えられませんでした:", e instanceof Error ? e.message : e);
    }
  }
  return (await readRow(code)).pid;
}

/** 誘った人に羽（ごほうびの行。活動日には数えない）。誰の印か分からなければ何もしない */
async function featherTo(pid: string | undefined, kind: SoloBonusKind, now = new Date()): Promise<void> {
  if (!pid) return;
  try {
    const log = bonusLog(kind, pid, jstDate(now), now.toISOString(), `sl-${randomBytes(6).toString("base64url")}`);
    await repo().insertSoloLog({ ...log, missionId: `inv-${randomBytes(4).toString("hex")}` }); // 何回でも（missionId を毎回変える）
  } catch (e) {
    console.error("[invite] 羽を記録できませんでした:", e instanceof Error ? e.message : e);
  }
}

export async function recordInviteOpen(code: string): Promise<void> {
  await featherTo(await bump(code, "opens"), "bonus_invite_open");
}
export async function recordInviteCheer(code: string): Promise<void> {
  await featherTo(await bump(code, "cheers"), "bonus_invite_cheer");
}

export async function readInviteStats(participantId: string): Promise<InviteStats> {
  const r = await readRow(inviteCode(participantId));
  return { opens: r.opens, cheers: r.cheers, joined: r.joined };
}

// ---- 誘われた人（LINE の中で招待リンクを開き、そのあと LINE でログインした人） ----

/** 誘われた人を、誘った人の印と結びつける（最初の1回だけ。自分で自分は誘えない） */
export async function linkInvitee(pid: string, code: string): Promise<boolean> {
  if (!isInviteCode(code) || code === inviteCode(pid)) return false;
  if (await inviterCodeOf(pid)) return false;
  invitedMem().set(pid, code);
  if (hasDb()) {
    try {
      await query(
        `insert into morning_state (key, state, updated_at) values ($1, jsonb_build_object('code', $2::text, 'paired', false), now()) on conflict (key) do nothing`,
        [`invited:${pid}`, code],
      );
    } catch (e) {
      console.error("[invite] 結びつけられませんでした:", e instanceof Error ? e.message : e);
      return false;
    }
  }
  return true;
}

async function inviterCodeOf(pid: string): Promise<string | undefined> {
  if (hasDb()) {
    try {
      const rows = await query<{ state: { code?: string } }>("select state from morning_state where key = $1", [`invited:${pid}`]);
      if (rows[0]?.state.code) return rows[0].state.code;
    } catch (e) {
      console.error("[invite] 読めませんでした:", e instanceof Error ? e.message : e);
    }
  }
  return invitedMem().get(pid);
}

/**
 * 誘われた人が初出動したとき: 誘った人を返す（1回だけ）。誘った人には羽 +20、「仲間」を1人数える。
 * 誰に誘われたか分からない・もう済んでいる・誘った人が分からないときは undefined。
 */
export async function claimPairing(pid: string): Promise<string | undefined> {
  const code = await inviterCodeOf(pid);
  if (!code) return undefined;
  const owner = (await readRow(code)).pid;
  if (!owner || owner === pid) return undefined;
  const flag = `paired:${pid}`;
  if (invitedMem().has(flag)) return undefined;
  if (hasDb()) {
    try {
      const rows = await query<{ key: string }>(
        `update morning_state set state = state || '{"paired": true}'::jsonb, updated_at = now() where key = $1 and coalesce((state->>'paired')::boolean, false) = false returning key`,
        [`invited:${pid}`],
      );
      if (rows.length === 0) return undefined;
    } catch (e) {
      console.error("[invite] 仲間を記録できませんでした:", e instanceof Error ? e.message : e);
      return undefined;
    }
  }
  invitedMem().set(flag, "1");
  await bump(code, "joined");
  await featherTo(owner, "bonus_invite_join");
  return owner;
}

/** 誘った結果のひとこと（0 なら出さない） */
export function inviteResultLine(s: InviteStats): string | undefined {
  const joined = s.joined ?? 0;
  if (s.opens <= 0 && s.cheers <= 0 && joined <= 0) return undefined;
  const parts = [
    s.opens > 0 && `${s.opens}人が見てくれて`,
    s.cheers > 0 && `${s.cheers}人が町を応援してくれて`,
    joined > 0 && `${joined}人が仲間になってくれて`,
  ].filter(Boolean) as string[];
  const text = parts.join("、").replace(/くれて$/, "くれました");
  return `あなたの誘いで、${text}。`;
}
