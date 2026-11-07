// マイページ（spec v1.32）の本番の操作。画面（/me）とホームから呼ぶ。
// なかま帳の相手＝一緒に活動した人（同じ家・同じ時のカードを一緒に受け取った人、成立した合流の相手）。それ以外の人は見えない。
// 「また一緒に」の手ふりは、なかま帳の相手にだけ。相手には隊長トークで1回だけ知らせ、返事はいらない（ゆるく）。
import { inboxKeyOf } from "../inbox/key";
import { addDays } from "../jst";
import { push } from "../line/client";
import { MSG } from "../line/messages";
import { loadMorning } from "../morning/store";
import { loadRoster } from "../morning/roster";
import { appToday } from "../morning/today";
import { listBatonsBy, listMeetupsFor, reactionsOf } from "../nakama/store";
import { repo } from "../repo";
import { onTeam } from "../member";
import type { TeamId } from "../types";
import {
  cleanIntro,
  cleanTags,
  cleanPhoto,
  defaultLook,
  hasContent,
  INTRO_MAX,
  isIconBgId,
  isIconId,
  shortDate,
  TALK_MAX,
  WAVE_DAYS,
  waveState,
  type MyProfile,
  type Wave,
} from "./rules";
import { getProfile, getProfiles, listWavesFor, putProfile, putWave } from "./store";

/** 仲間に見せるぶんのプロフィール（本人の ID は出さない） */
export interface PublicProfile {
  icon: MyProfile["icon"];
  iconBg: MyProfile["iconBg"];
  photo?: string;
  intro: string;
  likes: string[];
  interests: string[];
  talk: string;
}

export const toPublic = (p: MyProfile | undefined, participantId = ""): PublicProfile => ({
  icon: p?.icon ?? defaultLook(participantId).icon,
  iconBg: p?.iconBg ?? defaultLook(participantId).iconBg,
  ...(p?.photo ? { photo: p.photo } : {}),
  intro: p?.intro ?? "",
  likes: p?.likes ?? [],
  interests: p?.interests ?? [],
  talk: p?.talk ?? "",
});

export interface Companion {
  participantId: string;
  nickname: string;
  /** 今週のチーム（手伝う側で、チームに入っている人だけ） */
  teamId?: TeamId;
  profile: PublicProfile;
  hasProfile: boolean;
  /** 一緒に活動した回数（カードを一緒に受け取った家の数＋成立した合流） */
  times: number;
  /** 最後に一緒だった日（11/5 の形） */
  last: string;
  /** どう出会ったか */
  how: "card" | "meetup" | "both";
  wave: { mine: boolean; theirs: boolean; mutual: boolean };
}

export interface MypageView {
  nickname: string;
  teamId?: TeamId;
  profile: MyProfile | undefined;
  /** 自分のアイコン（まだ選んでいなければ、ID で決まるランダムなアイコン） */
  look: Pick<PublicProfile, "icon" | "iconBg" | "photo">;
  companions: Companion[];
  /** 手をふってくれた人の数（まだふり返していない） */
  wavesForMe: number;
  stats: {
    companions: number;
    meets: number;
    batons: number;
    thanks: number;
    days: number;
    cards: number;
  };
}

/** なかま帳の相手を集める（回数・最後の日・出会い方）。カードが読めなくても合流のぶんは出す */
export async function companionLog(id: string, now: Date): Promise<Map<string, { times: number; lastAt: string; card: boolean; meetup: boolean }>> {
  const r = repo();
  const out = new Map<string, { times: number; lastAt: string; card: boolean; meetup: boolean }>();
  const bump = (other: string, at: string, via: "card" | "meetup") => {
    const cur = out.get(other) ?? { times: 0, lastAt: at, card: false, meetup: false };
    cur.times += 1;
    if (at > cur.lastAt) cur.lastAt = at;
    cur[via] = true;
    out.set(other, cur);
  };
  try {
    const mine = await r.listCardsByRecipient(id);
    const missions = new Map<string, string>();
    for (const c of mine) missions.set(c.missionId, c.createdAt);
    for (const [mid, at] of [...missions].slice(-40)) {
      for (const c of await r.listCardsByMission(mid)) if (c.recipientId !== id) bump(c.recipientId, c.createdAt || at, "card");
    }
  } catch (e) {
    console.error("[mypage] カードから仲間を読めませんでした:", e instanceof Error ? e.message : e);
  }
  try {
    const record = await loadMorning();
    const today = appToday(record, now);
    for (const m of await listMeetupsFor(id, addDays(today, -365))) {
      if (m.status !== "accepted") continue;
      bump(m.fromId === id ? m.toId : m.fromId, m.respondedAt ?? m.createdAt, "meetup");
    }
  } catch (e) {
    console.error("[mypage] 合流から仲間を読めませんでした:", e instanceof Error ? e.message : e);
  }
  return out;
}

export async function mypageView(participantId: string, now: Date): Promise<MypageView | undefined> {
  const roster = await loadRoster();
  const me = roster.participants.find((p) => p.id === participantId);
  if (!me) return undefined;
  const [profile, log, waves] = await Promise.all([getProfile(me.id).catch(() => undefined), companionLog(me.id, now), listWavesFor(me.id).catch(() => [] as Wave[])]);
  const ids = [...log.keys()].filter((id) => roster.participants.some((p) => p.id === id));
  const profiles = await getProfiles(ids).catch(() => new Map<string, MyProfile>());
  const companions: Companion[] = ids
    .map((id) => {
      const p = roster.participants.find((x) => x.id === id)!;
      const l = log.get(id)!;
      const prof = profiles.get(id);
      return {
        participantId: id,
        nickname: p.nickname,
        teamId: onTeam(p) ? p.teamId : undefined,
        profile: toPublic(prof, id),
        hasProfile: hasContent(prof),
        times: l.times,
        last: shortDate(l.lastAt),
        how: l.card && l.meetup ? "both" : l.meetup ? "meetup" : "card",
        wave: waveState(me.id, id, waves, now),
      } satisfies Companion;
    })
    // 手をふってくれた人 → 最近一緒だった人、の順
    .sort((a, b) => Number(b.wave.theirs && !b.wave.mine) - Number(a.wave.theirs && !a.wave.mine) || (log.get(b.participantId)!.lastAt > log.get(a.participantId)!.lastAt ? 1 : -1));

  const [logs, cards, batons] = await Promise.all([
    repo().listSoloLogsByParticipant(me.id).catch(() => []),
    repo().listCardsByRecipient(me.id).catch(() => []),
    listBatonsBy(me.id, "2000-01-01").catch(() => []),
  ]);
  const thanks = await reactionsOf(batons.map((b) => b.id))
    .then((m) => [...m.values()].reduce((a, x) => a + x.thanks, 0))
    .catch(() => 0);
  return {
    nickname: me.nickname,
    teamId: onTeam(me) ? me.teamId : undefined,
    profile,
    look: toPublic(profile, me.id),
    companions,
    wavesForMe: companions.filter((c) => c.wave.theirs && !c.wave.mine).length,
    stats: {
      companions: companions.length,
      meets: companions.reduce((a, c) => a + (c.how !== "card" ? 1 : 0), 0),
      batons: batons.length,
      thanks,
      days: new Set(logs.filter((l) => l.onsite && !l.kind.startsWith("bonus_")).map((l) => l.date)).size,
      cards: cards.length,
    },
  };
}

// ---- プロフィールの保存 ----

export interface ProfileInput {
  icon?: string;
  iconBg?: string;
  /** 写真の data URL。null = 写真をやめる、undefined = 前のまま */
  photo?: string | null;
  intro?: string;
  likes?: unknown;
  interests?: unknown;
  talk?: string;
}

/** 画面から来た中身を点検して保存。名前・住所・体のことは落ちる（落ちたことは画面に出す） */
export async function saveProfile(participantId: string, input: ProfileInput, now: Date): Promise<{ ok: boolean; text: string; profile?: MyProfile }> {
  const me = await repo().findParticipant(participantId);
  if (!me) return { ok: false, text: "登録が見つかりません。ログインし直してください。" };
  const before = await getProfile(me.id).catch(() => undefined);
  const intro = cleanIntro(input.intro ?? before?.intro ?? "", INTRO_MAX);
  const talk = cleanIntro(input.talk ?? before?.talk ?? "", TALK_MAX);
  const photo = input.photo === undefined ? before?.photo : cleanPhoto(input.photo);
  const p: MyProfile = {
    participantId: me.id,
    icon: isIconId(input.icon) ? input.icon : (before?.icon ?? defaultLook(me.id).icon),
    iconBg: isIconBgId(input.iconBg) ? input.iconBg : (before?.iconBg ?? defaultLook(me.id).iconBg),
    ...(photo ? { photo } : {}),
    intro,
    likes: input.likes === undefined ? (before?.likes ?? []) : cleanTags(input.likes),
    interests: input.interests === undefined ? (before?.interests ?? []) : cleanTags(input.interests),
    talk,
    updatedAt: now.toISOString(),
  };
  await putProfile(p);
  const dropped = (input.intro?.trim() && !intro) || (input.talk?.trim() && !talk);
  return { ok: true, text: dropped ? "保存しました。名前・住所・体のことばは、仲間に見せる文からは外しています。" : "保存しました。一緒に活動した仲間に見えます。", profile: p };
}

// ---- 「また一緒に」の手ふり ----

/** なかま帳の相手にだけ。30日に1回。相手の隊長トークに1回だけ知らせる（返事はいらない） */
export async function waveTo(fromId: string, toId: string, now: Date): Promise<{ ok: boolean; text: string; mutual?: boolean }> {
  if (fromId === toId) return { ok: false, text: "自分には手をふれません。" };
  const roster = await loadRoster();
  const me = roster.participants.find((p) => p.id === fromId);
  const other = roster.participants.find((p) => p.id === toId);
  if (!me || !other) return { ok: false, text: "相手が見つかりませんでした。" };
  const log = await companionLog(fromId, now);
  if (!log.has(toId)) return { ok: false, text: "一緒に活動した仲間にだけ、手をふれます。" };
  const waves = await listWavesFor(fromId).catch(() => [] as Wave[]);
  const st = waveState(fromId, toId, waves, now);
  if (st.mine) return { ok: false, text: `もう手をふっています（${WAVE_DAYS}日のあいだ届いています）。` };
  await putWave({ fromId, toId, at: now.toISOString() });
  const mutual = st.theirs;
  const key = inboxKeyOf(other);
  if (key) await push(key, MSG.nakamaWave({ fromName: me.nickname, mutual })).catch(() => false);
  return {
    ok: true,
    mutual,
    text: mutual
      ? `おたがいに「また一緒に」。雪の朝に「前回の仲間と」を選ぶと、${other.nickname}さんが先に候補に出ます。`
      : `${other.nickname}さんに手をふりました。返事はいりません。雪の朝に会えたら、またどうぞ。`,
  };
}

/** 合流の候補で先に出す相手（おたがいに手をふった仲間）。なかまの画面から呼ぶ */
export async function mutualWavesOf(participantId: string, now: Date): Promise<Set<string>> {
  const out = new Set<string>();
  try {
    const waves = await listWavesFor(participantId);
    for (const w of waves) {
      const other = w.fromId === participantId ? w.toId : w.fromId;
      if (waveState(participantId, other, waves, now).mutual) out.add(other);
    }
  } catch (e) {
    console.error("[mypage] 手ふりを読めませんでした:", e instanceof Error ? e.message : e);
  }
  return out;
}
