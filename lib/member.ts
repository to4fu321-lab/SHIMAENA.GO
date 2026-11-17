// お互いさま（spec v1.10）: お願いする側も、本人の LINE があればチームに入り、雪かきに出られる。
// 家族の代理登録の人（本人の LINE がない）はチームに入れない。
import { repo } from "./repo";
import type { Participant } from "./types";

/** チームの一員として出動・得点ができる人か */
export function onTeam(p: Pick<Participant, "role" | "teamId" | "lineUserId"> | undefined | null): boolean {
  if (!p?.teamId) return false;
  return p.role === "helper" || (p.role === "requester" && Boolean(p.lineUserId));
}

/** 前に登録したお願いする側の人に、チームがなければ入れる（入れたら新しい参加者を返す） */
export async function ensureTeam(p: Participant): Promise<Participant> {
  if (p.role !== "requester" || p.teamId || !p.lineUserId) return p;
  const r = repo();
  const { teamForNewMember } = await import("./game/near-team"); // near-team がこのファイルを読むので、使うときに読む
  const next: Participant = { ...p, teamId: await teamForNewMember(p.location, p.id) };
  await r.upsertParticipant(next);
  return next;
}
