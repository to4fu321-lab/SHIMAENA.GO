// 隊長の声かけ（spec v1.18）: 誰に声をかけるかの決まり。純粋な関数（保存や Claude には触れない）。
// 手伝う側だけ。7日以上活動がない人、はじめて見てから3日たっても初出動のない人。1人 2週間に1回まで、
// 声かけのあとも活動がなければ次は4週間後。「休む」「いらない」と返したら1週間黙る。設定で止められる。
export const INACTIVE_DAYS = 7;
export const FIRST_DAYS = 3;
export const INTERVAL_DAYS = 14;
export const REPEAT_DAYS = 28;
export const QUIET_DAYS = 7;

export interface NudgeState {
  /** この人を声かけの対象として初めて見た時刻（登録の時刻の代わり） */
  firstSeen: string; // ISO
  /** 最後に声をかけた時刻 */
  lastAt?: string;
  /** 最後に声をかけたときの、その人の最後の活動の時刻（そのあと動いたかを見る） */
  activeAtLast?: string;
  /** ここまでは黙る（「休む」「いらない」の返事） */
  skipUntil?: string;
  /** 設定で止めている */
  off?: boolean;
}

export interface NudgeCandidate {
  id: string;
  role: "helper" | "requester";
  /** 最後の活動（ソロ・家の手伝い・応援・相談）。なければ undefined */
  lastActiveAt?: string;
}

const days = (from: string, now: Date) => (now.getTime() - Date.parse(from)) / 86400000;

/** いま声をかけてよいか */
export function shouldNudge(c: NudgeCandidate, state: NudgeState, now: Date): boolean {
  if (c.role !== "helper") return false;
  if (state.off) return false;
  if (state.skipUntil && Date.parse(state.skipUntil) > now.getTime()) return false;
  if (c.lastActiveAt) {
    if (days(c.lastActiveAt, now) < INACTIVE_DAYS) return false;
  } else if (days(state.firstSeen, now) < FIRST_DAYS) return false;
  if (state.lastAt) {
    // 前の声かけのあとに動いた人は2週間、動いていない人は4週間あける
    const movedSince = c.lastActiveAt ? Date.parse(c.lastActiveAt) > Date.parse(state.lastAt) : false;
    if (days(state.lastAt, now) < (movedSince ? INTERVAL_DAYS : REPEAT_DAYS)) return false;
  }
  return true;
}

/** 「休む」「忙しい」「いらない」など、しばらく黙ってほしい返事か */
export const QUIET_WORDS = /^(今日は)?(休む|休みます|やすむ|忙しい|いそがしい|いらない|いらないです|やめて|結構です|けっこうです|声かけ不要|しばらく無理|無理です)[。！!]?$/;

export function quietUntil(now: Date): string {
  return new Date(now.getTime() + QUIET_DAYS * 86400000).toISOString();
}
