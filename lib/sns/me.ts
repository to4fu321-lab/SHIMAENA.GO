// 個人の活動カード（me）の数字: 本人の台帳とカードだけから（サーバー側）。
import { STYLE_NAME } from "../cards/rarity";
import { soloStatus } from "../solo/ops";
import { repo } from "../repo";
import type { MeStats } from "./text";

export async function loadMeStats(participantId: string, now: Date = new Date()): Promise<MeStats & { nickname: string }> {
  const [p, st, cards] = await Promise.all([
    repo().findParticipant(participantId),
    soloStatus(participantId, now),
    repo().listCardsByRecipient(participantId).catch(() => []),
  ]);
  const todayLogs = st.recent.filter((l) => l.date === st.today && !l.kind.startsWith("bonus_"));
  return {
    nickname: p?.nickname ?? "わたし",
    todayFeathers: st.todayFeathers,
    streak: st.streak,
    todayActs: todayLogs.length,
    shimaena: cards[0] ? STYLE_NAME[cards[0].style] : undefined,
    hitokoto: [...todayLogs].reverse().find((l) => l.hitokoto)?.hitokoto ?? todayLogs[0]?.hitokoto,
  };
}
