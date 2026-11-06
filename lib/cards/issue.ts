// 完了した家の人にカードを発行する: レア判定 → Claude が文字 → SVG → 保存 → LINE で2枚（表・裏）。
import type { PhotoDepth } from "../snow-estimate";
import type { CardScene } from "./scene";
import type { RevealCard } from "./reveal";
import { randomBytes } from "node:crypto";
import { cardText } from "../claude/card";
import { jstMinutes } from "../jst";
import { inboxKeyOf } from "../inbox/key";
import { push } from "../line/client";
import { MSG } from "../line/messages";
import type { LineMessage } from "../line/types";
import type { MorningRecord } from "../morning/flow";
import type { Roster } from "../morning/roster";
import { repo } from "../repo";
import { getTeam } from "../teams";
import { TOWN } from "../town";
import { baseUrl } from "../url";
import type { Card, Mission, Participant, SnowType, Sortie } from "../types";
import { decideRarity } from "./rarity";
import { backExtras, renderCardBackSvg, renderCardSvg, type CardArt } from "./svg";

export { baseUrl };

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
  /** このカードが最初の1枚だった人（初出撃） */
  firstFlightIds: string[];
  /** この時だけの設計図の番号（v1.8） */
  sceneCode?: string;
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
    return p ? [{ id: p.id, name: p.nickname, teamId: x.teamId, lineUserId: inboxKeyOf(p) }] : [];
  });
  if (members.length === 0) return { cards: [], sent: 0, firstFlightIds: [] };
  // 初出撃: まだ1枚もカードがない人（この朝の分を入れる前に調べる）
  const firstFlightIds: string[] = [];
  for (const m of members) if ((await r.listCardsByRecipient(m.id)).length === 0) firstFlightIds.push(m.id);
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
    snowType: sorties.find((x) => x.photoCheck?.snowType)?.photoCheck?.snowType,
    photoDepth: sorties.find((x) => x.photoCheck?.depth)?.photoCheck?.depth,
    modelDepthCm: s.morning.rollcall.depthCm,
    thanks: Boolean(s.thanks?.[mission.id]),
    mixed: new Set(members.map((m) => m.teamId)).size >= 2,
    seed: `${s.morning.rollcall.id}|${mission.id}`,
  });
  mission.snowKg = text.snowKg; // 町内の「どけた雪の合計」に使う
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
      snowKgBasis: text.snowKgBasis,
      scene: text.scene,
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
      teamIds: [...new Set(art.members.flatMap((x) => (x.teamId ? [x.teamId] : [])))],
      createdAt: completedAt,
    };
    const firstFlight = firstFlightIds.includes(m.id);
    const svg = renderCardSvg(art);
    const back = renderCardBackSvg(art, {
      thanks: opts.thanks ?? "今朝はありがとうございました。おかげで玄関から出られます。",
      subtasks: mission.subtasks.map((t) => `${t.label}（${t.minutes}分）`),
      firstFlight,
    });
    await r.insertCard(card, svg, back);
    cards.push(card);
    if (m.lineUserId) {
      // 初出撃の歓迎は、カードと同じ1回のプッシュにまとめる
      await push(m.lineUserId, [...(firstFlight ? MSG.firstFlight(art.townName) : []), ...cardImageMessages(card.id)]);
      sent++;
    }
  }
  s.log.push(
    `拠点${base?.number ?? "?"}のカード「${text.designName}」（${rarity.label} ${"★".repeat(rarity.stars)}）を ${cards.length} 枚発行` +
      (firstFlightIds.length > 0 ? `（初出撃 ${firstFlightIds.length} 人）` : ""),
  );
  return { cards, sent, firstFlightIds, sceneCode: text.scene.code };
}

/** 保存してあるカードから、裏面を描くのに要る分だけ CardArt を組み立てる（裏面は人の並びを使わない） */
/** 完了画面の「カード発行」の演出に渡す形（spec v1.8） */
export function revealOf(card: Card, date: string, code?: string): RevealCard {
  return {
    id: card.id,
    designName: card.designName,
    style: card.style,
    serial: card.serial,
    issuedCount: card.issuedCount,
    townName: TOWN.name.replace(/（.*）$/, ""),
    date,
    stampText: card.snowKg > 0 ? `${card.snowKg}kg` : "ソロ",
    ...(code ? { code } : {}),
  };
}

export function artFromCard(card: Card, date: string): CardArt {
  const teamIds = card.teamIds;
  return {
    style: card.style,
    designName: card.designName,
    designNameEn: card.designNameEn,
    rarityLabel: card.rarityLabel,
    stars: card.stars,
    members: card.memberNames.map((name, i) => ({ name, teamId: teamIds.length > 0 ? teamIds[i % teamIds.length] : undefined })),
    date,
    townName: TOWN.name.replace(/（.*）$/, ""),
    snowKg: card.snowKg,
    snowKgComparison: card.snowKgComparison,
    serial: card.serial,
    issuedCount: card.issuedCount,
    stampText: card.snowKg > 0 ? undefined : "ソロ",
  };
}

/** ソロ出動のカードの種類: 初回＝かわいい、5日連続＝ドット絵（図鑑の「五日連続の群れ」が埋まる）。カードの種類は増やさない */
export type SoloCardVariant = "first" | "streak5" | "daily" | "pair";

const SOLO_CARD: Record<SoloCardVariant, { style: Card["style"]; designName: string; designNameEn: string; rarityLabel: string; stars: 1 | 2 | 3; flavor: string }> = {
  first: { style: "kawaii", designName: "はじめてのソロ出動", designNameEn: "First Solo Flight", rarityLabel: "ひとりの群れ", stars: 1, flavor: "Five minutes, one bird" },
  streak5: { style: "pixel", designName: "五日目のドット", designNameEn: "Day Five, Pixel Perfect", rarityLabel: "五日連続の群れ", stars: 3, flavor: "5 DAYS STREAK" },
  // v1.8: ふだんのソロ出動も毎回1枚（名前・副題・場面はその時の事実から Claude が。1枚限定）
  daily: { style: "kawaii", designName: "ひとりの十分間", designNameEn: "Ten Minutes, One Bird", rarityLabel: "ひとりの群れ", stars: 1, flavor: "One bird, one path" },
  // v1.8 仲間を増やす: 誘われた人が初出動したとき、誘った人と誘われた人の二人に
  pair: { style: "kawaii", designName: "ふたりの群れ", designNameEn: "Two Birds, One Snow", rarityLabel: "仲間の群れ", stars: 2, flavor: "Bring a friend!" },
};

/**
 * ソロ出動のカードを1枚発行する（合成 ID: rollcall は solo-<日付>、mission は solo-<台帳の ID>）。
 * 朝のカードの通し番号（◯/◯枚）は汚さない。LINE があれば表・裏を送る（初出撃なら歓迎も）。
 */
export async function issueSoloCard(
  p: Participant,
  opts: {
    variant: SoloCardVariant;
    date: string;
    logId: string;
    hitokoto: string;
    missionLabel: string;
    firstFlight: boolean;
    at: string;
    /** v1.8: 自宅の雪かきでどけた雪（手がかりがあるときだけ） */
    snow?: { snowKg: number; snowKgComparison: string; snowKgBasis: string };
    /** v1.8: 場面とカードの名前の材料（その時の雪・写真の深さ・雪質） */
    weather?: { forecastCm: number; depthCm?: number; snowType?: SnowType; photoDepth?: PhotoDepth };
  },
): Promise<Card> {
  const v = SOLO_CARD[opts.variant];
  // その時だけの場面（と、ふだんの1枚なら名前・副題）を Claude に。失敗しても決まった名前で発行する
  let named: { designName: string; designNameEn: string; flavor: string; scene?: CardScene } = { designName: v.designName, designNameEn: v.designNameEn, flavor: v.flavor };
  try {
    const t = await cardText({
      date: opts.date,
      completedAtJst: hm(opts.at),
      forecastCm: opts.weather?.forecastCm ?? 0,
      level: 1,
      clearArea: p.clearArea ?? "entrance",
      memberCount: 1,
      teamNames: p.teamId ? [getTeam(p.teamId).name] : [],
      style: v.style,
      rarityLabel: v.rarityLabel,
      snowType: opts.weather?.snowType,
      photoDepth: opts.weather?.photoDepth,
      modelDepthCm: opts.weather?.depthCm,
      seed: `solo|${opts.logId}`,
    });
    named = opts.variant === "daily" ? { designName: t.designName, designNameEn: t.designNameEn, flavor: t.flavor, scene: t.scene } : { ...named, scene: t.scene };
  } catch (e) {
    console.error("[solo] カードの名前と場面を作れませんでした（決まった名前で発行します）:", e instanceof Error ? e.message : e);
  }
  const art: CardArt = {
    style: v.style,
    designName: named.designName,
    designNameEn: named.designNameEn,
    rarityLabel: v.rarityLabel,
    stars: v.stars,
    members: [{ name: p.nickname, teamId: p.teamId }],
    date: opts.date,
    townName: TOWN.name.replace(/（.*）$/, ""),
    snowKg: opts.snow?.snowKg ?? 0,
    snowKgComparison: opts.snow?.snowKgComparison ?? "ソロ出動",
    ...(opts.snow ? { snowKgBasis: opts.snow.snowKgBasis } : {}),
    serial: 1,
    issuedCount: 1,
    flavor: named.flavor,
    stampText: opts.snow ? `${opts.snow.snowKg}kg` : "ソロ",
    ...(named.scene ? { scene: named.scene } : {}),
  };
  const card: Card = {
    id: `c-${randomBytes(6).toString("base64url")}`,
    recipientId: p.id,
    rollcallId: `solo-${opts.date}`,
    missionId: `solo-${opts.logId}`,
    serial: 1,
    issuedCount: 1,
    designName: art.designName,
    designNameEn: art.designNameEn,
    rarityLabel: art.rarityLabel,
    stars: art.stars,
    style: art.style,
    snowKg: art.snowKg,
    snowKgComparison: art.snowKgComparison,
    memberNames: [p.nickname],
    teamIds: p.teamId ? [p.teamId] : [],
    createdAt: opts.at,
  };
  const svg = renderCardSvg(art);
  const back = renderCardBackSvg(art, { thanks: opts.hitokoto, subtasks: [`${opts.missionLabel}（ソロ出動）`], firstFlight: opts.firstFlight });
  await repo().insertCard(card, svg, back);
  // LINE に送るのは特別な1枚だけ（はじめて・5日連続・仲間）。ふだんの1枚は画面で見せる（月の通数を使わないため。v1.8）
  const k = inboxKeyOf(p);
  if (k && opts.variant !== "daily") {
    const head = opts.variant === "pair" && !opts.firstFlight ? MSG.pairJoined() : opts.firstFlight ? MSG.firstFlight(art.townName) : [];
    await push(k, [...head, ...cardImageMessages(card.id)]);
  }
  return card;
}

/**
 * ありがとう点呼が届いたら、その家のカードの裏面を作り直す（依頼者の一言が入る）。
 * 発行済みのカードそのもの（表・番号・枚数）は変えない。
 */
export async function rerenderBacks(missionId: string, back: { date: string; thanks: string; subtasks: string[] }): Promise<number> {
  const r = repo();
  const cards = await r.listCardsByMission(missionId);
  for (const card of cards) {
    // その人のいちばん古いカードなら初出撃のリボンを残す
    const mine = await r.listCardsByRecipient(card.recipientId);
    const firstFlight = mine.length > 0 && mine[mine.length - 1].id === card.id;
    // 前の裏面にあった「設計図」と「推定の元」は残す（v1.8）
    const old = await r.getCard(card.id);
    const extras = old ? backExtras(old.backSvg) : {};
    const art: CardArt = { ...artFromCard(card, back.date), snowKgBasis: extras.basis, scene: extras.scene as CardArt["scene"] };
    const svg = renderCardBackSvg(art, { thanks: back.thanks, subtasks: back.subtasks, firstFlight });
    await r.updateCardBack(card.id, svg);
  }
  return cards.length;
}
