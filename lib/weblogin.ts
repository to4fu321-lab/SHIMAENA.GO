// LINE アプリを使わずに参加する（spec v1.16）: Safari などのブラウザで「LINE で送ってログイン」。
// ブラウザが短い合言葉（ログイン ABC123）を出す → 本人が LINE で公式アカウントに送る → Webhook がその LINE の人と合言葉を結ぶ
// → ブラウザが数秒ごとに確かめて、結ばれたら「この画面の自分」にする。LINE ログインの設定は要らない。
// 安全: 合言葉は10分で切れ、1回だけ。合言葉を出したブラウザ（cookie の印）でしか使えない。LINE には「ログインしました」と返す。
import { createHash, randomBytes, randomInt } from "node:crypto";
import { hasDb, query } from "./db";

export const WEB_LOGIN_MINUTES = 10;
/** 紛らわしい文字（0/O・1/I）を使わない */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newLoginCode(): string {
  return Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
export function newNonce(): string {
  return randomBytes(18).toString("base64url");
}
const hash = (s: string) => createHash("sha256").update(s).digest("base64url");

/** LINE で送られた文から合言葉を読む（「ログイン ABC123」。全角・小文字も受ける） */
export function parseLoginText(text: string): string | undefined {
  const t = text.normalize("NFKC").trim().toUpperCase();
  const m = /^ログイン\s*([A-Z0-9]{6})$/.exec(t);
  return m?.[1];
}

interface Row {
  code: string;
  nonce_hash: string;
  participant_id: string | null;
  created_at: string;
  used: boolean;
}

const TABLE = `create table if not exists web_logins (
  code text primary key, nonce_hash text not null, participant_id text, created_at timestamptz not null default now(), used boolean not null default false)`;
let ready: Promise<void> | undefined;
const ensure = () =>
  (ready ??= query(TABLE)
    .then(() => undefined)
    .catch((e) => {
      ready = undefined;
      throw e;
    }));

const g = globalThis as { __shimaenaWebLogin?: Map<string, Row> };
const mem = () => (g.__shimaenaWebLogin ??= new Map());

const fresh = (r: Row, now: Date) => now.getTime() - Date.parse(r.created_at) < WEB_LOGIN_MINUTES * 60_000;

/** ブラウザ用に合言葉を作る（nonce はそのブラウザの cookie に入れる） */
export async function createLogin(nonce: string, now = new Date()): Promise<string> {
  const code = newLoginCode();
  const row: Row = { code, nonce_hash: hash(nonce), participant_id: null, created_at: now.toISOString(), used: false };
  if (!hasDb()) {
    mem().set(code, row);
    return code;
  }
  await ensure();
  await query("delete from web_logins where created_at < now() - interval '1 day'");
  await query("insert into web_logins (code, nonce_hash, created_at) values ($1, $2, $3)", [code, row.nonce_hash, row.created_at]);
  return code;
}

/** LINE で合言葉が送られた: その人と結ぶ。期限切れ・使用済み・もう結ばれている は false */
export async function bindLogin(code: string, participantId: string, now = new Date()): Promise<boolean> {
  if (!hasDb()) {
    const r = mem().get(code);
    if (!r || r.used || r.participant_id || !fresh(r, now)) return false;
    r.participant_id = participantId;
    return true;
  }
  await ensure();
  const rows = await query<{ code: string }>(
    `update web_logins set participant_id = $2 where code = $1 and participant_id is null and not used
       and created_at > $3::timestamptz - interval '${WEB_LOGIN_MINUTES} minutes' returning code`,
    [code, participantId, now.toISOString()],
  );
  return rows.length > 0;
}

/** ブラウザが確かめる: 自分（nonce）の合言葉が結ばれていれば参加者 ID を返し、使用済みにする */
export async function claimLogin(code: string, nonce: string, now = new Date()): Promise<string | undefined> {
  const nh = hash(nonce);
  if (!hasDb()) {
    const r = mem().get(code);
    if (!r || r.used || r.nonce_hash !== nh || !r.participant_id || !fresh(r, now)) return undefined;
    r.used = true;
    return r.participant_id;
  }
  await ensure();
  const rows = await query<{ participant_id: string }>(
    `update web_logins set used = true where code = $1 and nonce_hash = $2 and participant_id is not null and not used
       and created_at > $3::timestamptz - interval '${WEB_LOGIN_MINUTES} minutes' returning participant_id`,
    [code, nh, now.toISOString()],
  );
  return rows[0]?.participant_id;
}
