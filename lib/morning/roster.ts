// 名簿: 参加者と拠点。架空の町内（town.json）と、LINE で登録した本物の人が混ざる。
import { inboxKeyOf } from "../inbox/key";
import { repo } from "../repo";
import { TOWN } from "../town";
import type { Base, Participant } from "../types";

export interface Roster {
  participants: Participant[];
  bases: Base[];
}

/** 架空の町内だけの名簿（テストと、DB がないとき） */
export const TOWN_ROSTER: Roster = { participants: TOWN.participants, bases: TOWN.bases };

export async function loadRoster(): Promise<Roster> {
  const r = repo();
  const [participants, bases] = await Promise.all([r.listParticipants(), r.listBases()]);
  return { participants, bases };
}

/** 隊長トークの届け先の鍵（届け先のない人は除く）。名前は LINE のころのまま */
export function lineIds(participants: Participant[]): string[] {
  return participants.flatMap((p) => {
    const k = inboxKeyOf(p);
    return k ? [k] : [];
  });
}
