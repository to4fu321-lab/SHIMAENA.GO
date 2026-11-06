// 隊長トーク（inbox）の「あて先の鍵」（spec v1.17）。
// 本物の人は LINE のアカウント ID（ログインに使う ID と同じ。participants.line_user_id）。
// デモの架空の人（h1・r2 など）は demo:<参加者 ID>（デモの操作が許されているときだけ）。架空の人には lineUserId を持たせない
// （lineUserId の有無は「本物の人か」の印として、点呼のランダム回答などで使っているため）。
import { demoEnabled } from "../env";
import type { Participant } from "../types";

export const DEMO_PREFIX = "demo:";
/** 架空の人の ID の形（lib/viewer.ts の isDemoViewer と同じ） */
const DEMO_ID = /^[hr]\d+$/;

/** その人の隊長トークの鍵。届け先がなければ undefined（家族の代理登録の家など） */
export function inboxKeyOf(p: Pick<Participant, "id" | "lineUserId"> | undefined | null): string | undefined {
  if (!p) return undefined;
  if (p.lineUserId) return p.lineUserId;
  return demoEnabled() && DEMO_ID.test(p.id) ? `${DEMO_PREFIX}${p.id}` : undefined;
}

/** demo:<参加者 ID> の鍵なら、その参加者 ID。それ以外は undefined */
export function demoParticipantId(key: string | undefined | null): string | undefined {
  if (!key || !key.startsWith(DEMO_PREFIX)) return undefined;
  const id = key.slice(DEMO_PREFIX.length);
  return demoEnabled() && DEMO_ID.test(id) ? id : undefined;
}
