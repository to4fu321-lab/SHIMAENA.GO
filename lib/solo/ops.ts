// ソロ出動の「本番の操作」（spec v1.3）。台帳を読み、ミッションを完了にして、羽・ボーナス・ひとこと・カードを付ける。
// チーム得点（morning_state の scores）には一切触らない。家の完了（help_house）は朝の一本道（lib/morning/ops.ts）が記録する。
import { randomBytes } from "node:crypto";
import { issueSoloCard } from "../cards/issue";
import { cellKey } from "../cells";
import { checkPhoto, decidePhoto, type PhotoInput } from "../claude/photo";
import { soloHitokoto } from "../claude/solo";
import { addDays } from "../jst";
import { loadMorning } from "../morning/store";
import { appToday } from "../morning/today";
import { repo } from "../repo";
import type { Card, Participant, SoloLog } from "../types";
import { activeDates, bonusLog, bonusesDue, feathersOn, nextCard, streakDays, totalFeathers, type NextCard } from "./feathers";
import { HELP_HOUSE_FEATHERS, SOLO_BONUS, soloLabel, soloMission, type SoloMission } from "./missions";

const newId = () => `sl-${randomBytes(6).toString("base64url")}`;

export interface SoloClearSummary {
  kind: SoloMission["kind"];
  label: string;
  onsite: boolean;
  /** いま入った羽（ボーナスを除く） */
  feathers: number;
  bonuses: { label: string; feathers: number }[];
  todayFeathers: number;
  totalFeathers: number;
  streak: number;
  /** 最初のカード（初出撃） */
  firstEver: boolean;
  card?: Card;
  hitokoto: string;
  nextCard: NextCard;
  /** 写真を付けたとき: 確認できたか／報告として受け付けたか */
  photoNote?: string;
}

export type SoloResult =
  | { ok: true; summary: SoloClearSummary }
  | { ok: false; reason: "not_registered" | "unknown" | "already" | "help_house"; text: string };

/**
 * ソロミッションを1つ完了にする。同じ種類は1日1回。写真は任意（Claude が確認、判断できなくても報告として受け付ける）。
 */
export async function completeSolo(
  participantId: string,
  kind: string,
  opts: { photo?: PhotoInput; note?: string; now: Date },
): Promise<SoloResult> {
  const r = repo();
  const p = await r.findParticipant(participantId);
  if (!p) return { ok: false, reason: "not_registered", text: "登録が見つかりません。LINE から開いてください。" };
  const mission = soloMission(kind);
  if (!mission) return { ok: false, reason: "unknown", text: "そのミッションはありません。" };
  if (mission.kind === "help_house") {
    return { ok: false, reason: "help_house", text: "家の雪かきは、地図の「5分だけ参加」から加わって、写真で完了にしてください。" };
  }
  const record = await loadMorning();
  const today = appToday(record, opts.now);
  const at = opts.now.toISOString();
  const before = await r.listSoloLogsByParticipant(p.id);
  if (before.some((l) => l.date === today && l.kind === mission.kind)) {
    return { ok: false, reason: "already", text: `「${mission.label}」は今日はもう完了しています。別のミッションをどうぞ。` };
  }

  // 写真（任意）: Claude が確認。判断できなくても報告として受け付ける（AI を最終判定者にしない）
  let photoChecked: boolean | undefined;
  let photoNote: string | undefined;
  if (opts.photo && mission.photo === "optional") {
    const check = await checkPhoto(opts.photo);
    const outcome = decidePhoto(check);
    photoChecked = outcome === "done";
    photoNote = outcome === "done" ? `写真を確認しました。${check.comment}` : `写真では確かめきれませんでしたが、報告として受け付けました。${check.comment}`;
  }

  const log: SoloLog = {
    id: newId(),
    participantId: p.id,
    date: today,
    kind: mission.kind,
    onsite: mission.onsite,
    feathers: mission.feathers,
    at,
  };
  if (opts.note) log.note = opts.note.slice(0, 60);
  if (photoChecked !== undefined) log.photoChecked = photoChecked;
  if (mission.onsite) log.cellKey = cellKey(p.location); // 50m マス。正確な位置は持たない

  const cards = await r.listCardsByRecipient(p.id);
  const firstEver = cards.length === 0;
  const after = [...before, log];
  const streak = streakDays(activeDates(after), today);
  const due = bonusesDue(after, today);
  const bonuses = due.map((k) => bonusLog(k, p.id, today, at, newId()));
  const all = [...after, ...bonuses];
  const hitokoto = (
    await soloHitokoto({
      label: mission.label,
      onsite: mission.onsite,
      feathers: mission.feathers,
      todayFeathers: feathersOn(all, today),
      totalFeathers: totalFeathers(all),
      streak,
      firstEver,
    })
  ).text;
  log.hitokoto = hitokoto;

  if (!(await r.insertSoloLog(log))) {
    return { ok: false, reason: "already", text: `「${mission.label}」は今日はもう完了しています。` };
  }
  for (const b of bonuses) await r.insertSoloLog(b);

  // カード: 最初の1枚（初出撃）、5日連続のボーナスが付いた朝はドット絵
  let card: Card | undefined;
  try {
    if (firstEver) {
      card = await issueSoloCard(p, { variant: "first", date: today, logId: log.id, hitokoto, missionLabel: mission.label, firstFlight: true, at });
    } else if (due.includes("bonus_streak5")) {
      card = await issueSoloCard(p, { variant: "streak5", date: today, logId: log.id, hitokoto, missionLabel: mission.label, firstFlight: false, at });
    }
  } catch (e) {
    console.error("[solo] カードを発行できませんでした:", e instanceof Error ? e.message : e);
  }

  const summary: SoloClearSummary = {
    kind: mission.kind,
    label: mission.label,
    onsite: mission.onsite,
    feathers: mission.feathers,
    bonuses: due.map((k) => SOLO_BONUS[k]),
    todayFeathers: feathersOn(all, today),
    totalFeathers: totalFeathers(all),
    streak,
    firstEver,
    card,
    hitokoto,
    nextCard: nextCard(card ? [...cards, card] : cards, streak),
    photoNote,
  };
  return { ok: true, summary };
}

/**
 * 家の完了（朝の一本道）を来た人の台帳に 10羽 で残す。同じ家（missionId）は1回だけ。チーム得点には触らない。
 * 日付はアプリの「今日」（デモは 12 月の朝）。戻り値は実際に入った人数
 */
export async function recordHouseFeathers(
  participants: Pick<Participant, "id" | "location">[],
  opts: { missionId: string; baseLocation?: [number, number]; today: string; now: Date },
): Promise<number> {
  const r = repo();
  let n = 0;
  for (const p of participants) {
    const log: SoloLog = {
      id: newId(),
      participantId: p.id,
      date: opts.today,
      kind: "help_house",
      onsite: true,
      feathers: HELP_HOUSE_FEATHERS,
      missionId: opts.missionId,
      cellKey: cellKey(opts.baseLocation ?? p.location),
      at: opts.now.toISOString(),
    };
    try {
      if (await r.insertSoloLog(log)) {
        n++;
        // 連続出動のボーナスは家の完了でも付く（1回だけ）
        const logs = await r.listSoloLogsByParticipant(p.id);
        for (const k of bonusesDue(logs, opts.today)) await r.insertSoloLog(bonusLog(k, p.id, opts.today, opts.now.toISOString(), newId()));
      }
    } catch (e) {
      console.error("[solo] 家の完了の羽を記録できませんでした:", e instanceof Error ? e.message : e);
    }
  }
  return n;
}

export interface SoloStatus {
  today: string;
  todayFeathers: number;
  totalFeathers: number;
  streak: number;
  /** 今日すでに終えた種類 */
  doneToday: SoloMission["kind"][];
  /** 直近7日の台帳（新しい順） */
  recent: (SoloLog & { label: string })[];
  nextCard: NextCard;
  cards: number;
}

/** 画面の「今日の自分」: 台帳から集計する。表がまだないときは空で返す（画面を止めない） */
export async function soloStatus(participantId: string, now: Date): Promise<SoloStatus> {
  const record = await loadMorning();
  const today = appToday(record, now);
  let logs: SoloLog[] = [];
  let cards: Card[] = [];
  try {
    [logs, cards] = await Promise.all([repo().listSoloLogsByParticipant(participantId), repo().listCardsByRecipient(participantId)]);
  } catch (e) {
    console.error("[solo] 台帳を読めませんでした（/admin で DB を準備してください）:", e instanceof Error ? e.message : e);
  }
  const streak = streakDays(activeDates(logs), today);
  const from = addDays(today, -6);
  return {
    today,
    todayFeathers: feathersOn(logs, today),
    totalFeathers: totalFeathers(logs),
    streak,
    doneToday: logs.filter((l) => l.date === today && !l.kind.startsWith("bonus_")).map((l) => l.kind as SoloMission["kind"]),
    recent: logs
      .filter((l) => l.date >= from && l.date <= today)
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .map((l) => ({ ...l, label: soloLabel(l.kind) })),
    nextCard: nextCard(cards, streak),
    cards: cards.length,
  };
}
