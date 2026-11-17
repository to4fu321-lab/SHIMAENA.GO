// 名簿: 参加者と拠点。架空のエリア（town.json）と、LINE で登録した本物の人が混ざる。
import { inboxKeyOf } from "../inbox/key";
import { repo } from "../repo";
import { TOWN } from "../town";
import type { Base, Participant } from "../types";
import { currentWorld, isDemoId, type World } from "../world";

export interface Roster {
  participants: Participant[];
  bases: Base[];
}

/** 架空のエリアだけの名簿（テストと、DB がないとき） */
export const TOWN_ROSTER: Roster = { participants: TOWN.participants, bases: TOWN.bases };

/**
 * その町の人と家だけにする（spec v1.70）: 本番の町は本物の人とその家、サンプルの町は架空の人と架空の家。
 * 町を決めていないとき（テスト・昔からの入口）は全員（今までどおり）。
 */
export function rosterOf(all: Roster, world: World | undefined): Roster {
  if (!world) return all;
  const mine = (id: string | undefined) => isDemoId(id) === (world === "demo");
  return { participants: all.participants.filter((p) => mine(p.id)), bases: all.bases.filter((b) => mine(b.requesterId)) };
}

export async function loadRoster(): Promise<Roster> {
  const r = repo();
  const [participants, bases] = await Promise.all([r.listParticipants(), r.listBases()]);
  return rosterOf({ participants, bases }, currentWorld());
}

/** 隊長トークの届け先の鍵（届け先のない人は除く）。名前は LINE のころのまま */
export function lineIds(participants: Participant[]): string[] {
  return participants.flatMap((p) => {
    const k = inboxKeyOf(p);
    return k ? [k] : [];
  });
}
