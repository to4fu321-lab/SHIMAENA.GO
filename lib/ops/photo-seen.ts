// 同じ写真の使い回しを見分ける（spec v1.8）。同じ日に、同じ写真（中身がまったく同じ）が2回来たら「別の写真を」と返す。
// 写真そのものは残さない。残すのは写真の指紋（SHA-256）だけで、日付ごとに morning_state の「photo_seen:YYYY-MM-DD」の行へ。
// Claude を呼ぶ前に調べるので、同じ写真で2回お金を使わない。
import { createHash } from "node:crypto";
import { hasDb, query } from "../db";

const g = globalThis as { __shimaenaPhotoSeen?: Map<string, Set<string>> };
const mem = () => (g.__shimaenaPhotoSeen ??= new Map());

export function photoFingerprint(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 32);
}

/** その日にもう受け付けた写真か */
export async function photoSeen(date: string, fp: string): Promise<boolean> {
  if (mem().get(date)?.has(fp)) return true;
  if (!hasDb()) return false;
  try {
    const rows = await query<{ hit: boolean }>("select coalesce(state->'items' ? $2, false) as hit from morning_state where key = $1", [`photo_seen:${date}`, fp]);
    return Boolean(rows[0]?.hit);
  } catch (e) {
    console.error("[photo-seen] 調べられませんでした:", e instanceof Error ? e.message : e);
    return false; // 調べられないときは受け付ける（取りこぼすよりはまし）
  }
}

/** 受け付けた写真の指紋を残す */
export async function rememberPhoto(date: string, fp: string): Promise<void> {
  const set = mem().get(date) ?? new Set<string>();
  set.add(fp);
  mem().set(date, set);
  if (!hasDb()) return;
  try {
    await query(
      `insert into morning_state (key, state, updated_at) values ($1, jsonb_build_object('items', jsonb_build_array($2::text)), now())
       on conflict (key) do update set updated_at = now(),
         state = jsonb_build_object('items', coalesce(morning_state.state->'items', '[]'::jsonb) || jsonb_build_array($2::text))`,
      [`photo_seen:${date}`, fp],
    );
  } catch (e) {
    console.error("[photo-seen] 残せませんでした:", e instanceof Error ? e.message : e);
  }
}
