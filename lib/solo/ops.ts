// ソロ出動の「本番の操作」（spec v1.3）。台帳を読み、ミッションを完了にして、羽・ボーナス・ひとこと・カードを付ける。
// v1.7: チームの得点にも入る（自分の家 +5・見回りなど +3・写真の確認 +2・オンライン +1〔1日3点まで〕、1人1日 15点まで。lib/solo/team-points.ts）。
//家の完了（help_house）は朝の一本道（lib/morning/ops.ts）が記録する。
import { mockInvites } from "../claude/invite";
import { claimPairing, inviteResultLine, inviteUrl, readInviteStats } from "../invite";
import { allowedAtNight, isNight, nightRefusal } from "../night";
import { onTeam } from "../member";
import { randomBytes } from "node:crypto";
import { revealOf } from "../cards/issue";
import type { RevealCard } from "../cards/reveal";
import { cellKey } from "../cells";
import { checkPhoto, decidePhoto, hazardLines, type PhotoInput } from "../claude/photo";
import { photoFingerprint, photoSeen, rememberPhoto } from "../ops/photo-seen";
import { mockSoloHitokoto, soloHitokoto } from "../claude/solo";
import { runLater } from "../ops/later";
import { withStateLock } from "../ops/lock";
import { inboxKeyOf } from "../inbox/key";
import { push } from "../line/client";
import { POINTS } from "../game/score";
import { scoreSolo, SOLO_TEAM_DAILY_CAP } from "../game/score";
import { getTeam } from "../teams";
import { addDays } from "../jst";
import { loadMorning, saveMorning } from "../morning/store";
import { endHome, startHome } from "./home-now";
import { appToday } from "../morning/today";
import { repo } from "../repo";
import { refreshShareTextsLater } from "../sns/refresh";
import type { Card, Participant, SoloLog } from "../types";
import { soloSnow } from "../snow-estimate";
import { activeDates, bonusLog, bonusesDue, feathersOn, nextCard, streakDays, totalFeathers, type NextCard } from "./feathers";
import { addSoloScores, soloPointsToday } from "./team-points";
import { HELP_HOUSE_FEATHERS, REPEATABLE, SOLO_BONUS, SOLO_MISSIONS, soloLabel, soloMission, type SoloMission } from "./missions";

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
  /** v1.8: カード発行の演出に渡す形 */
  reveal?: RevealCard;
  /** v1.8: 仲間を誘う3案（友だちへ・家族へ・職場や学校の人へ）・招待リンク・誘った結果 */
  invites?: string[];
  inviteUrl?: string;
  inviteResult?: string;
  /** v1.8: 自宅の雪かきでどけた雪（手がかりがない日はなし） */
  snowKg?: number;
  snowKgComparison?: string;
  snowKgBasis?: string;
  hitokoto: string;
  nextCard: NextCard;
  /** 写真を付けたとき: 確認できたか／報告として受け付けたか */
  photoNote?: string;
  /** 写真を Claude が確認できたか（バトンの「写真で確認済み」に使う。spec v1.13） */
  photoChecked?: boolean;
  /** v1.31: スコップカウンターの回数（数えたときだけ） */
  strokes?: number;
  /** 今日この種類を終えた回数（自分の家の雪かきは何回でも。2回目なら 2） */
  timesToday: number;
  /** v1.7: チームに入った点（現地の活動だけ。オンラインとチームのない人は 0） */
  teamPoints: number;
  teamName?: string;
  /** 今日のソロのチーム得点が上限（15点）に届いたか */
  teamCapped: boolean;
  /** 次のおすすめ（今日まだの、外でやる10分ミッション） */
  nextMission?: string;
}

export type SoloResult =
  | { ok: true; summary: SoloClearSummary }
  | { ok: false; reason: "not_registered" | "unknown" | "already" | "help_house" | "night"; text: string };

/**
 * ソロミッションを1つ完了にする。同じ種類は1日1回。写真は任意（Claude が確認、判断できなくても報告として受け付ける）。
 */
export async function completeSolo(
  participantId: string,
  kind: string,
  opts: { photo?: PhotoInput; note?: string; strokes?: number; now: Date },
): Promise<SoloResult> {
  const r = repo();
  const p = await r.findParticipant(participantId);
  if (!p) return { ok: false, reason: "not_registered", text: "登録が見つかりません。LINE から開いてください。" };
  const mission = soloMission(kind);
  if (!mission) return { ok: false, reason: "unknown", text: "そのミッションはありません。" };
  if (mission.kind === "help_house") {
    return { ok: false, reason: "help_house", text: "家の雪かきは、地図の「10分だけ参加」から加わって、写真で完了にしてください。" };
  }
  // 夜（19時〜6時）は、自分の家と家の中でできることだけ（spec v1.8 防犯）
  if (isNight(opts.now) && !allowedAtNight(mission.kind, mission.onsite)) {
    return { ok: false, reason: "night", text: nightRefusal() };
  }
  const record = await loadMorning();
  const today = appToday(record, opts.now);
  const at = opts.now.toISOString();
  const before = await r.listSoloLogsByParticipant(p.id);
  // 自分の家の雪かきは1日に何回でも（11/7 本人の指摘「朝に1回したら2度目ができない」。降り続く日は朝と昼で2回になる）。
  // ほかのミッションは1日1回のまま。台帳の一意 index（参加者・日付・種類・missionId）に当たらないよう、2回目からは missionId に回数の印を入れる
  const timesToday = before.filter((l) => l.date === today && l.kind === mission.kind).length;
  if (timesToday > 0 && !REPEATABLE.has(mission.kind)) {
    return { ok: false, reason: "already", text: `「${mission.label}」は今日はもう完了しています。別のミッションをどうぞ。` };
  }

  // 写真（任意）: Claude の確認（30〜60秒）は返事のあとで（spec v1.58: 待たせない）。確認できたら写真の +2 点を足し、結果は隊長トークへ。
  // 判断できなくても報告として受け付ける（AI を最終判定者にしない）
  let photoChecked: boolean | undefined;
  let photoNote: string | undefined;
  let checkLater: PhotoInput | undefined;
  if (opts.photo && mission.photo === "optional") {
    // 同じ日に同じ写真なら、Claude を呼ばずに「確認済み」にしない（使い回しを防ぐ。活動の記録はそのまま受け付ける）
    const fp = photoFingerprint(opts.photo.bytes);
    if (await photoSeen(today, fp)) {
      photoChecked = false;
      photoNote = "前に送られた写真と同じだったので、写真の確認はしませんでした。活動の記録は受け付けました。";
    } else {
      checkLater = opts.photo;
      photoNote = "写真は隊長があとで確かめて、隊長トークでお知らせします。";
    }
  }

  // 自宅の雪かき: どけた雪の kg（写真の深さ・その日の予報・積雪深から。手がかりがない日は出さない。spec v1.8）
  const snow =
    mission.kind === "own_house"
      ? soloSnow({
          today,
          rollcall: record.morning.rollcall,
          area: p.clearArea, // 写真の確認は返事のあとなので、深さ・雪質は予報と積雪深から（spec v1.58）
        })
      : undefined;

  const log: SoloLog = {
    id: newId(),
    participantId: p.id,
    date: today,
    kind: mission.kind,
    onsite: mission.onsite,
    feathers: mission.feathers,
    at,
  };
  if (timesToday > 0) log.missionId = `again-${timesToday + 1}`; // 2回目・3回目…の印（家の手伝いの missionId とは別物）
  if (opts.note) log.note = opts.note.slice(0, 60);
  if (photoChecked !== undefined) log.photoChecked = photoChecked;
  if (mission.onsite && opts.strokes) log.strokes = opts.strokes; // v1.31 スコップカウンター（現地だけ。得点には入れない）
  if (mission.onsite) log.cellKey = cellKey(p.location); // 50m マス。正確な位置は持たない

  const cards = await r.listCardsByRecipient(p.id);
  const firstEver = cards.length === 0;
  const after = [...before, log];
  const streak = streakDays(activeDates(after), today);
  const due = bonusesDue(after, today);
  const bonuses = due.map((k) => bonusLog(k, p.id, today, at, newId()));
  const all = [...after, ...bonuses];
  // 隊長のひとこと（Claude）は 3 秒まで。間に合わなければ決まった文（spec v1.58: 待たせない）
  const hitokotoInput = {
    label: mission.label,
    onsite: mission.onsite,
    feathers: mission.feathers,
    todayFeathers: feathersOn(all, today),
    totalFeathers: totalFeathers(all),
    streak,
    firstEver,
  };
  let hitokotoTimer: ReturnType<typeof setTimeout> | undefined;
  const hitokoto = (
    await Promise.race([
      soloHitokoto(hitokotoInput).catch(() => mockSoloHitokoto(hitokotoInput)),
      new Promise<{ text: string }>((resolve) => (hitokotoTimer = setTimeout(() => resolve(mockSoloHitokoto(hitokotoInput)), 3000))),
    ]).finally(() => clearTimeout(hitokotoTimer))
  ).text;
  log.hitokoto = hitokoto;

  if (!(await r.insertSoloLog(log))) {
    return { ok: false, reason: "already", text: `「${mission.label}」は今日はもう完了しています。` };
  }
  for (const b of bonuses) await r.insertSoloLog(b);

  // チームの得点（現地だけ・1人1日 15点まで）。失敗しても羽と記録は残す
  let teamPoints = 0;
  let teamCapped = false;
  if (onTeam(p) && p.teamId) {
    try {
      const already = await soloPointsToday(record, p.id, today);
      const events = scoreSolo({ kind: mission.kind, onsite: mission.onsite, photoChecked, teamId: p.teamId, participantId: p.id, at }, already.all, already.online);
      await addSoloScores(record, today, events);
      teamPoints = events.reduce((a, e) => a + e.points, 0);
      teamCapped = already.all + teamPoints >= SOLO_TEAM_DAILY_CAP;
    } catch (e) {
      console.error("[solo] チームの得点を記録できませんでした:", e instanceof Error ? e.message : e);
    }
  }

  // カード: ソロ出動では出さない（spec v1.58。カードは家の雪かきだけ・夜に届く）。誘われて仲間になった記録だけ残す
  const card: Card | undefined = undefined;
  if (firstEver) await claimPairing(p.id).catch(() => undefined);

  await refreshShareTextsLater(); // 今日の出動人数が変わったので、投稿文を作り直す（返事のあとで）
  // 仲間を誘う（v1.8）: いまの本当の出来事（kg・カード）から3案。リンクには「あなたからの招待」の印。失敗しても完了は止めない
  // spec v1.58: Claude を待たず、決まった文の3案（その時の事実から作る）
  const invites: string[] = mockInvites({
    minutes: mission.minutes,
    firstTime: firstEver,
    snowCm: record.morning.rollcall.date === today ? record.morning.rollcall.forecastCm : 0,
    teamName: p.teamId ? getTeam(p.teamId).name : undefined,
    snowKg: snow?.snowKg,
    solo: true,
  });
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
    reveal: card ? revealOf(card, today) : undefined,
    ...(snow ? { snowKg: snow.snowKg, snowKgComparison: snow.snowKgComparison, snowKgBasis: snow.snowKgBasis } : {}),
    hitokoto,
    nextCard: nextCard(card ? [...cards, card] : cards, streak),
    photoNote,
    photoChecked,
    strokes: log.strokes,
    timesToday: timesToday + 1,
    teamPoints,
    teamName: p.teamId ? getTeam(p.teamId).name : undefined,
    teamCapped,
    invites,
    inviteUrl: inviteUrl(p.id),
    inviteResult: inviteResultLine(await readInviteStats(p.id)),
    nextMission: SOLO_MISSIONS.find(
      (m) => m.onsite && m.kind !== "help_house" && m.kind !== mission.kind && !after.some((l) => l.date === today && l.kind === m.kind),
    )?.label,
  };
  // 自宅の雪かきを終えた人は「いま雪かき中」から抜ける
  if (mission.kind === "own_house") await finishHomeNow(p.id);
  if (checkLater) {
    const photo = checkLater;
    const teamId = onTeam(p) ? p.teamId : undefined;
    runLater("solo/photo-check", () => checkSoloPhotoLater({ participantId: p.id, inboxKey: inboxKeyOf(p), teamId, label: mission.label, onsite: mission.onsite, logId: log.id, today, at, photo }));
  }
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

// ---- いま自宅を雪かき中（11/4）: 「いまから始める」と「クリア！」 ----

/** 自分の家の雪かきを「いまから始める」。夜でも自分の家は OK（lib/night.ts） */
export async function startHomeNow(participantId: string, now: Date): Promise<{ ok: boolean; text: string }> {
  const p = await repo().findParticipant(participantId);
  if (!p) return { ok: false, text: "登録が見つかりません。LINE から開いてください。" };
  const s = await loadMorning();
  startHome(s, p.id, now);
  await saveMorning(s);
  return { ok: true, text: "いま自宅を雪かき中。終わったら「クリア！」を押してください。" };
}

export async function stopHomeNow(participantId: string): Promise<void> {
  return finishHomeNow(participantId);
}

async function finishHomeNow(participantId: string): Promise<void> {
  const s = await loadMorning();
  if (endHome(s, participantId)) await saveMorning(s);
}


/**
 * ソロの写真を、返事のあとで Claude が確かめる（spec v1.58）。確認できたら写真の点（+2・1日の上限まで）を足し、結果を隊長トークへ。
 * 活動の記録・羽はもう受け付けてあるので、ここで失敗しても何も取り消さない。
 */
async function checkSoloPhotoLater(o: {
  participantId: string;
  inboxKey?: string;
  teamId?: Participant["teamId"];
  label: string;
  onsite: boolean;
  logId: string;
  today: string;
  at: string;
  photo: PhotoInput;
}): Promise<void> {
  const check = await checkPhoto(o.photo);
  const outcome = decidePhoto(check);
  const ok = outcome === "done";
  let added = 0;
  if (ok) {
    await rememberPhoto(o.today, photoFingerprint(o.photo.bytes));
    if (o.teamId && o.onsite) {
      await withStateLock("solo/photo-check", async () => {
        const record = await loadMorning();
        const already = await soloPointsToday(record, o.participantId, o.today);
        const room = Math.max(0, SOLO_TEAM_DAILY_CAP - already.all);
        const p = Math.min(POINTS.solo_photo, room);
        if (p <= 0) return;
        await addSoloScores(record, o.today, [
          { id: `sc${Date.now().toString(36)}p`, teamId: o.teamId!, participantId: o.participantId, points: p, reason: "solo_photo", at: o.at },
        ]);
        added = p;
      });
    }
  }
  const seen = check.evidence ? `（${check.evidence}）` : "";
  const line = ok
    ? `「${o.label}」の写真を確かめました${seen}。${check.comment}${added > 0 ? ` 写真の点 +${added}。` : ""}`
    : check.unrelated
      ? `「${o.label}」の写真は、雪の写真ではないようでした。活動の記録はそのまま受け付けています。`
      : `「${o.label}」の写真では確かめきれませんでしたが、報告として受け付けています。${check.comment}`;
  const hz = hazardLines(check);
  if (o.inboxKey) await push(o.inboxKey, [{ type: "text", text: `📷 ${line}${hz.length > 0 ? `\n⚠️ ${hz.join(" ")}` : ""}` }]);
}
