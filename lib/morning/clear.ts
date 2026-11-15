// ミッション完了の「まとめ」（spec v1.1: MISSION CLEAR）。点の内訳・チーム得点・雪HPの減りを1つの形にする。
// 得点そのものは lib/game/score.ts が決める。ここは見せるために集計するだけ（純粋な関数）。
import type { RevealCard } from "../cards/reveal";
import { estimateDepth } from "../snow-estimate";
import { SNOW_TYPE_LABEL, hazardLines, WIDTH_LABEL } from "../claude/photo";
import type { ScoreEvent, ScoreReason, TeamId } from "../types";
import type { Roster } from "./roster";
import { type MorningState, progress, snowHp, teamTotals } from "./view";

export const REASON_LABEL: Record<ScoreReason, string> = {
  mission_done: "完了",
  early: "朝ボーナス（9時まで）",
  dokayuki: "ドカ雪ボーナス",
  rescue: "駆けつけ",
  flock: "同じチーム2人以上",
  mixed: "2チームが合流",
  scout: "偵察",
  supply: "補給",
  requester_joined: "本人も参加",
  weekly_goal: "週の目標",
  solo_home: "ソロ: 自分の家の雪かき",
  solo_onsite: "ソロ: 現地の活動",
  solo_photo: "ソロ: 写真で確認",
  solo_online: "ソロ: アプリで参加",
  home_cheer: "応援・おつかれさま",
};

export interface ClearItem {
  reason: ScoreReason;
  label: string;
  count: number;
  points: number;
}

export interface ClearSummary {
  missionId: string;
  baseNumber: number | string;
  snowName?: string;
  /** 来た人の呼び名 */
  members: string[];
  teamIds: TeamId[];
  /** この家で入った点の内訳（理由ごと） */
  items: ClearItem[];
  /** この家で入った点（全チーム合計） */
  totalPoints: number;
  /** 今朝のチーム合計（加算後） */
  teamTotals: Record<TeamId, number>;
  /** 画面を見ている人が今朝ここまでに入れた点（個人順位は出さない。本人の記録だけ） */
  myPoints?: number;
  /** 画面を見ている人にとって、これが初出撃（最初のカード） */
  firstFlight?: boolean;
  /** 画面を見ている人が、この家に来た人のひとりか */
  mine?: boolean;
  /** 本人の完了のときだけ、その人の ID（完了画面のバトンと「次は？」に使う。spec v1.13） */
  viewerId?: string;
  /** あなたが主役の招待文（本人の完了のときだけ、spec v1.6） */
  invites?: string[];
  /** v1.8: 招待リンク（あなたからの招待の印つき）と、誘った結果のひとこと */
  inviteUrl?: string;
  inviteResult?: string;
  /** 写真の判定（spec v1.60。「1軒完了！」の画面に出す）: 3つの見立てと、隊長のひとこと。uncertain は「報告として受け付け」（写真なしの完了も） */
  photo?: { cleared: boolean; passable: boolean; icy: boolean; uncertain: boolean; comment: string; /** 判定はあとで届く（spec v1.68） */ pending?: boolean };
  /** 写真から見えた雪質（v1.2）と労いの一言 */
  snowTypeLabel?: string;
  care?: string;
  /** v1.8: Claude が写真で見たこと（判断の根拠）と通れる幅 */
  evidence?: string;
  widthLabel?: string;
  /** v1.8: 写真に見えた危ないもの（決まった安全の文） */
  hazards?: string[];
  /** v1.8: 雪質の見た目の理由と、雪の深さ（どの出どころか付き。例: 写真から約20〜30cm） */
  snowTypeReason?: string;
  depthLabel?: string;
  /** v1.8: 画面を見ている人に発行したカード（演出用） */
  card?: RevealCard;
  /** カードは今夜、隊長が届ける（spec v1.54）。完了画面で隊長が伝える */
  cardTonight?: boolean;
  hpBefore: number;
  hpAfter: number;
  hpMax: number;
  left: number;
  /** 今朝の家の数と、終わった家の数（この家を含む） */
  total: number;
  done: number;
  allDone: boolean;
  defeatedAt?: string;
  completedAt: string;
}

/** 理由ごとにまとめる（出てくる順は得点表の順） */
export function breakdown(events: ScoreEvent[]): ClearItem[] {
  const order = Object.keys(REASON_LABEL) as ScoreReason[];
  const map = new Map<ScoreReason, ClearItem>();
  for (const e of events) {
    const cur = map.get(e.reason) ?? { reason: e.reason, label: REASON_LABEL[e.reason], count: 0, points: 0 };
    cur.count++;
    cur.points += e.points;
    map.set(e.reason, cur);
  }
  return order.flatMap((r) => (map.has(r) ? [map.get(r)!] : []));
}

/** その家の完了で入った得点（完了時刻が同じで、来た人かそのチームのもの） */
export function eventsForMission(state: MorningState, missionId: string): ScoreEvent[] {
  const sorties = state.sorties.filter((x) => x.missionId === missionId && x.status === "done");
  const at = sorties.find((x) => x.completedAt)?.completedAt;
  if (!at) return [];
  const people = new Set(sorties.map((x) => x.participantId));
  const teams = new Set(sorties.map((x) => x.teamId));
  return state.scores.filter((e) => e.at === at && (e.participantId ? people.has(e.participantId) : teams.has(e.teamId)));
}

export function summarizeClear(
  state: MorningState,
  roster: Roster,
  missionId: string,
  opts: { hpBefore?: number; viewerId?: string; firstFlightIds?: string[] } = {},
): ClearSummary | null {
  const mission = state.missions.find((m) => m.id === missionId);
  if (!mission || mission.status !== "done") return null;
  const sorties = state.sorties.filter((x) => x.missionId === missionId && x.status === "done");
  const completedAt = sorties.find((x) => x.completedAt)?.completedAt ?? "";
  const byId = new Map(roster.participants.map((p) => [p.id, p]));
  const members = sorties.map((x) => byId.get(x.participantId)?.nickname ?? "").filter(Boolean);
  const teamIds: TeamId[] = [];
  for (const x of sorties) if (!teamIds.includes(x.teamId)) teamIds.push(x.teamId);
  const events = eventsForMission(state, missionId);
  const items = breakdown(events);
  const hp = snowHp(state);
  const prog = progress(state);
  const myPoints =
    opts.viewerId === undefined
      ? undefined
      : state.scores.filter((e) => e.participantId === opts.viewerId).reduce((a, e) => a + e.points, 0);
  const mine = opts.viewerId === undefined ? undefined : sorties.some((x) => x.participantId === opts.viewerId);
  const firstFlight = opts.viewerId === undefined ? undefined : mine && (opts.firstFlightIds ?? []).includes(opts.viewerId);
  const check = sorties.find((x) => x.photoCheck)?.photoCheck;
  const snowTypeLabel = check?.snowType && check.snowType !== "unknown" ? SNOW_TYPE_LABEL[check.snowType] : undefined;
  return {
    missionId,
    baseNumber: roster.bases.find((b) => b.id === mission.baseId)?.number ?? "?",
    snowName: state.rollcall.snowName,
    members,
    teamIds,
    items,
    totalPoints: events.reduce((a, e) => a + e.points, 0),
    teamTotals: teamTotals(state),
    myPoints,
    firstFlight,
    mine,
    ...(mine && opts.viewerId ? { viewerId: opts.viewerId } : {}),
    ...(check ? { photo: { cleared: check.cleared, passable: check.passable, icy: check.icy, uncertain: Boolean(check.uncertain), comment: check.comment, ...(check.pending ? { pending: true } : {}) } } : {}),
    snowTypeLabel,
    care: check?.care || undefined,
    evidence: check?.evidence || undefined,
    widthLabel: check?.width && check.width !== "unknown" ? WIDTH_LABEL[check.width] : undefined,
    hazards: check ? hazardLines(check) : undefined,
    snowTypeReason: check?.snowTypeReason || undefined,
    depthLabel: estimateDepth({ forecastCm: state.rollcall.forecastCm, modelDepthCm: state.rollcall.depthCm, photo: check?.depth }).label,
    hpBefore: opts.hpBefore ?? Math.min(hp.max, hp.current + state.rollcall.forecastCm),
    hpAfter: hp.current,
    hpMax: hp.max,
    left: prog.left,
    total: prog.total,
    done: prog.done,
    allDone: prog.allDone,
    defeatedAt: prog.defeatedAt,
    completedAt,
  };
}

/** 本人の完了なら、招待文を添える */
export function withInvites(c: ClearSummary | null, invites?: string[]): ClearSummary | null {
  return c && c.mine && invites && invites.length > 0 ? { ...c, invites } : c;
}

/**
 * いちばん最近に完了した家のまとめ（他の人の完了に気づくため）。なければ null。
 * 「最近」は時刻ではなく完了した順（得点が記録された順）で決める。デモの時計（12月の朝）と本当の時刻が混ざっても狂わない。
 */
export function latestClear(state: MorningState, roster: Roster, viewerId?: string, firstFlightIds?: string[]): ClearSummary | null {
  let best: { missionId: string; index: number; at: string } | undefined;
  for (const m of state.missions) {
    if (m.status !== "done") continue;
    const at = state.sorties.find((x) => x.missionId === m.id && x.completedAt)?.completedAt;
    if (!at) continue;
    const index = Math.max(-1, ...eventsForMission(state, m.id).map((e) => state.scores.indexOf(e)));
    if (!best || index > best.index || (index === best.index && at > best.at)) best = { missionId: m.id, index, at };
  }
  return best ? summarizeClear(state, roster, best.missionId, { viewerId, firstFlightIds }) : null;
}

/** 「今日はここまで！」のまとめ（spec v1.57）: その日の自分の活動を1画面に。1軒ずつの完了は軽い知らせだけにして、点はここでまとめて見せる */
export interface DaySummary {
  viewerId: string;
  /** 今日、自分の手で終えた家（終えた順） */
  houses: { baseNumber: number | string; points: number }[];
  /** 自分の点の合計（自分に付いた点。チームの合流ボーナスなど人に付かない点は入れない） */
  myPoints: number;
  teamId?: TeamId;
  teamTotals: Record<TeamId, number>;
  /** どけた雪（自分が行った家の合計） */
  snowKg: number;
  /** はじめての出動だったか */
  firstFlight: boolean;
  /** 今夜届くカードの枚数 */
  cardsTonight: number;
  /** 町のようす */
  townDone: number;
  townTotal: number;
  allDone: boolean;
  snowName?: string;
  /** 招待文（あれば） */
  invites?: string[];
  /** 最後に終えた家（バトン・次は？に使う） */
  lastMissionId: string;
  lastPhotoChecked: boolean;
}

export function daySummary(
  state: MorningState,
  roster: Roster,
  viewerId: string,
  opts: { firstFlightIds?: string[]; invites?: string[]; cardsTonight?: number } = {},
): DaySummary | null {
  const mine = state.sorties
    .filter((x) => x.participantId === viewerId && x.status === "done" && x.completedAt)
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!));
  if (mine.length === 0) return null;
  const houses = mine.flatMap((x) => {
    const m = state.missions.find((mm) => mm.id === x.missionId);
    if (!m) return [];
    const points = eventsForMission(state, m.id)
      .filter((e) => e.participantId === viewerId)
      .reduce((a, e) => a + e.points, 0);
    return [{ baseNumber: roster.bases.find((b) => b.id === m.baseId)?.number ?? "?", points, kg: m.snowKg ?? 0 }];
  });
  const prog = progress(state);
  return {
    viewerId,
    houses: houses.map(({ baseNumber, points }) => ({ baseNumber, points })),
    myPoints: houses.reduce((a, h) => a + h.points, 0),
    teamId: roster.participants.find((p) => p.id === viewerId)?.teamId ?? mine[0].teamId,
    teamTotals: teamTotals(state),
    snowKg: houses.reduce((a, h) => a + h.kg, 0),
    firstFlight: (opts.firstFlightIds ?? []).includes(viewerId),
    cardsTonight: opts.cardsTonight ?? 0,
    townDone: prog.done,
    townTotal: prog.total,
    allDone: prog.allDone,
    snowName: state.rollcall.snowName,
    ...(opts.invites && opts.invites.length > 0 ? { invites: opts.invites } : {}),
    lastMissionId: mine.at(-1)!.missionId,
    lastPhotoChecked: Boolean(state.sorties.find((x) => x.missionId === mine.at(-1)!.missionId && x.photoCheck?.evidence)),
  };
}
