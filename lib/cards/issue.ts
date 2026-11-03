// 完了した家の人にカードを発行する: レア判定 → Claude が文字 → SVG → 保存 → LINE で2枚（表・裏）。
import { randomBytes } from "node:crypto";
import { cardText } from "../claude/card";
import { jstMinutes } from "../jst";
import { push } from "../line/client";
import type { LineMessage } from "../line/types";
import type { MorningRecord } from "../morning/flow";
import type { Roster } from "../morning/roster";
import { repo } from "../repo";
import { getTeam } from "../teams";
import { TOWN } from "../town";
import type { Card, Mission, Sortie } from "../types";
import { decideRarity } from "./rarity";
import { renderCardBackSvg, renderCardSvg, type CardArt } from "./svg";

/** 公開 URL（LINE に画像の URL を渡すため） */
export function baseUrl(): string {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "http://localhost:3000";
}

export function cardImageMessages(cardId: string): LineMessage[] {
  const base = baseUrl();
  const img = (side: "front" | "back"): LineMessage => ({
    type: "image",
    originalContentUrl: `${base}/api/cards/${cardId}/${side}.png`,
    previewImageUrl: `${base}/api/cards/${cardId}/${side}.png?size=preview`,
  });
  return [img("front"), img("back")];
}

const hm = (iso: string) => {
  const m = jstMinutes(new Date(iso));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export interface IssuedCards {
  cards: Card[];
  /** LINE に送った人数 */
  sent: number;
}

/**
 * 1軒ぶんのカードを、来た人の数だけ発行する（同じ絵・同じ名前、通し番号だけ違う）。
 * 発行枚数（◯枚限定）は「その朝に出撃した人数」で、後から増えない。
 */
export async function issueCardsForMission(
  s: MorningRecord,
  roster: Roster,
  mission: Mission,
  sorties: Sortie[],
  opts: { thanks?: string; streakDays?: number } = {},
): Promise<IssuedCards> {
  const r = repo();
  const byId = new Map(roster.participants.map((p) => [p.id, p]));
  const members = sorties.flatMap((x) => {
    const p = byId.get(x.participantId);
    return p ? [{ id: p.id, name: p.nickname, teamId: x.teamId, lineUserId: p.lineUserId }] : [];
  });
  if (members.length === 0) return { cards: [], sent: 0 };
  const completedAt = sorties[0].completedAt ?? new Date().toISOString();
  const base = roster.bases.find((b) => b.id === mission.baseId);
  const requester = base && byId.get(base.requesterId);
  const rarity = decideRarity({
    completedAt,
    forecastCm: s.morning.rollcall.forecastCm,
    teamIds: members.map((m) => m.teamId),
    streakDays: opts.streakDays ?? 1,
  });
  const text = await cardText({
    date: s.morning.rollcall.date,
    completedAtJst: hm(completedAt),
    forecastCm: s.morning.rollcall.forecastCm,
    level: requester?.level ?? 2,
    clearArea: requester?.clearArea ?? "entrance",
    memberCount: members.length,
    teamNames: [...new Set(members.map((m) => getTeam(m.teamId).name))],
    style: rarity.style,
    rarityLabel: rarity.label,
  });
  const issuedCount = s.morning.sorties.length;
  const already = await r.countCardsForRollcall(s.morning.rollcall.id);
  const cards: Card[] = [];
  let sent = 0;
  for (const [i, m] of members.entries()) {
    const art: CardArt = {
      style: rarity.style,
      designName: text.designName,
      designNameEn: text.designNameEn,
      rarityLabel: rarity.label,
      stars: rarity.stars,
      members: members.map((x) => ({ name: x.name, teamId: x.teamId })),
      date: s.morning.rollcall.date,
      townName: TOWN.name.replace(/（.*）$/, ""),
      snowKg: text.snowKg,
      snowKgComparison: text.snowKgComparison,
      serial: already + i + 1,
      issuedCount: Math.max(issuedCount, already + members.length),
      flavor: text.flavor,
    };
    const card: Card = {
      id: `c-${randomBytes(6).toString("base64url")}`,
      recipientId: m.id,
      rollcallId: s.morning.rollcall.id,
      missionId: mission.id,
      serial: art.serial,
      issuedCount: art.issuedCount,
      designName: art.designName,
      designNameEn: art.designNameEn,
      rarityLabel: art.rarityLabel,
      stars: art.stars,
      style: art.style,
      snowKg: art.snowKg,
      snowKgComparison: art.snowKgComparison,
      memberNames: art.members.map((x) => x.name),
      teamIds: [...new Set(art.members.map((x) => x.teamId))],
      createdAt: completedAt,
    };
    const svg = renderCardSvg(art);
    const back = renderCardBackSvg(art, {
      thanks: opts.thanks ?? "今朝はありがとうございました。おかげで玄関から出られます。",
      subtasks: mission.subtasks.map((t) => `${t.label}（${t.minutes}分）`),
    });
    await r.insertCard(card, svg, back);
    cards.push(card);
    if (m.lineUserId) {
      await push(m.lineUserId, cardImageMessages(card.id));
      sent++;
    }
  }
  s.log.push(`拠点${base?.number ?? "?"}のカード「${text.designName}」（${rarity.label} ${"★".repeat(rarity.stars)}）を ${cards.length} 枚発行`);
  return { cards, sent };
}
