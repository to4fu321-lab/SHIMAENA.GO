// 声のありがとう（spec v1.29）の保存先。DATABASE_URL があれば Neon、なければメモリ（開発用）。
// 1軒（ミッション）に1つ。吹き込み直すと置きかわる。7日たったら消す。声は文字にしない・AI に渡さない。
import { hasDb, query } from "../db";
import { appNow } from "@/lib/clock";

export const VOICE_MAX_SECONDS = 30;
export const VOICE_MAX_BYTES = 2 * 1024 * 1024; // 30秒なら十分（opus で数百KB）
export const VOICE_KEEP_DAYS = 7;

export interface ThanksVoice {
  missionId: string;
  requesterId: string;
  /** 聞いてよい人（その家を手伝った人） */
  helperIds: string[];
  mime: string;
  seconds: number;
  at: string; // ISO
}

const TABLE = `create table if not exists thanks_voices (
  mission_id text primary key, requester_id text not null, helper_ids text not null,
  mime text not null, audio text not null, seconds real not null, at timestamptz not null)`;
let ready: Promise<void> | undefined;
function ensure(): Promise<void> {
  ready ??= query(TABLE)
    .then(() => undefined)
    .catch((e) => {
      ready = undefined;
      throw e;
    });
  return ready;
}

const g = globalThis as { __shimaenaThanksVoice?: Map<string, ThanksVoice & { audio: string }> };
const mem = () => (g.__shimaenaThanksVoice ??= new Map());

/** 録音の形を確かめる（audio/webm・audio/mp4・audio/ogg など、ブラウザの録音の形だけ） */
export function okVoiceMime(mime: string): boolean {
  return /^audio\/(webm|mp4|ogg|mpeg|aac|x-m4a)(;.*)?$/.test(mime);
}

function cutoff(now: Date): string {
  return new Date(now.getTime() - VOICE_KEEP_DAYS * 86400_000).toISOString();
}

export async function saveThanksVoice(v: ThanksVoice, audio: Uint8Array, now = appNow()): Promise<void> {
  const b64 = Buffer.from(audio).toString("base64");
  if (!hasDb()) {
    mem().set(v.missionId, { ...v, audio: b64 });
    for (const [k, x] of mem()) if (x.at < cutoff(now)) mem().delete(k);
    return;
  }
  await ensure();
  await query(
    `insert into thanks_voices (mission_id, requester_id, helper_ids, mime, audio, seconds, at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (mission_id) do update set requester_id = excluded.requester_id, helper_ids = excluded.helper_ids,
       mime = excluded.mime, audio = excluded.audio, seconds = excluded.seconds, at = excluded.at`,
    [v.missionId, v.requesterId, v.helperIds.join(","), v.mime, b64, v.seconds, v.at],
  );
  await query(`delete from thanks_voices where at < $1`, [cutoff(now)]);
}

interface Row {
  mission_id: string;
  requester_id: string;
  helper_ids: string;
  mime: string;
  audio?: string;
  seconds: number;
  at: string | Date;
}
const toVoice = (r: Row): ThanksVoice => ({
  missionId: r.mission_id,
  requesterId: r.requester_id,
  helperIds: r.helper_ids.split(",").filter(Boolean),
  mime: r.mime,
  seconds: Number(r.seconds),
  at: r.at instanceof Date ? r.at.toISOString() : new Date(r.at).toISOString(),
});

/** 声の情報（音そのものは含まない）。7日より古いものは無いものとする */
export async function findThanksVoice(missionId: string, now = appNow()): Promise<ThanksVoice | undefined> {
  if (!hasDb()) {
    const x = mem().get(missionId);
    if (!x || x.at < cutoff(now)) return undefined;
    return { missionId: x.missionId, requesterId: x.requesterId, helperIds: x.helperIds, mime: x.mime, seconds: x.seconds, at: x.at };
  }
  await ensure();
  const rows = await query<Row>(
    `select mission_id, requester_id, helper_ids, mime, seconds, at from thanks_voices where mission_id = $1 and at >= $2`,
    [missionId, cutoff(now)],
  );
  return rows[0] ? toVoice(rows[0]) : undefined;
}

/** 声そのもの。聞いてよい人（家の人・手伝った人）のときだけ返す */
export async function readThanksVoice(
  missionId: string,
  viewerId: string,
  now = appNow(),
): Promise<{ mime: string; audio: Uint8Array } | undefined> {
  const v = await findThanksVoice(missionId, now);
  if (!v || !canListen(v, viewerId)) return undefined;
  if (!hasDb()) {
    const x = mem().get(missionId);
    return x ? { mime: x.mime, audio: new Uint8Array(Buffer.from(x.audio, "base64")) } : undefined;
  }
  const rows = await query<{ mime: string; audio: string }>(`select mime, audio from thanks_voices where mission_id = $1`, [missionId]);
  return rows[0] ? { mime: rows[0].mime, audio: new Uint8Array(Buffer.from(rows[0].audio, "base64")) } : undefined;
}

export function canListen(v: ThanksVoice, viewerId: string): boolean {
  return viewerId === v.requesterId || v.helperIds.includes(viewerId);
}

/** テスト用 */
export function resetThanksVoices(): void {
  mem().clear();
}
