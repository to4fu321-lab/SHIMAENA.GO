// シマエナGO の型定義。仕様は docs/spec.md。

/** 緯度・経度 */
export type LatLng = [lat: number, lng: number];

// ---- チーム ----
export type TeamId = "salvia" | "marigold" | "lupinus";

export interface Team {
  id: TeamId;
  name: string; // 例: サルビア
  nameEn: string; // 例: SALVIA
  color: string; // 例: #2F6FE4（赤と緑は使わない）
  colorName: string; // 例: 青
}

// ---- 参加者 ----
export type Role = "requester" | "helper";

/** 依頼者: 一人だといつも何分かかるか */
export type SoloMinutes = 15 | 30 | 60 | "unknown";
/** 依頼者: どこまで雪かきが必要か */
export type ClearArea = "entrance" | "garage" | "road";
/** 手伝う側: 朝に動ける分数 */
export type MorningMinutes = 15 | 30 | 60;

export interface Participant {
  id: string;
  nickname: string; // カードと通知に出す呼び名（実名でなくてよい）
  role: Role;
  location: LatLng; // 自宅。表示は 50m 単位に丸める
  lineUserId?: string;
  teamId?: TeamId; // 手伝う側のみ
  // 依頼者の登録2問
  soloMinutes?: SoloMinutes;
  clearArea?: ClearArea;
  level?: 1 | 2 | 3; // Claude が判定
  // 手伝う側の登録2問
  morningMinutes?: MorningMinutes;
  hasTools?: boolean;
  /** 家族が代わりに登録した場合、その家族の参加者 ID */
  registeredByFamilyId?: string;
}

/** 依頼者の家族（通知を受け取る人） */
export interface FamilyLink {
  familyLineUserId: string;
  requesterId: string;
  linkCode: string;
}

// ---- 地図 ----
export interface Building {
  id: string;
  polygon: LatLng[];
}

/**
 * 拠点 = 依頼者の家。地図上は「50m マス」と番号だけを出し、どの建物かは出さない。
 * 正確な場所は、割り当てられた人の LINE にだけ届ける。
 */
export interface Base {
  id: string;
  number: number; // 地図に出す番号
  requesterId: string;
}

// ---- 点呼 ----
export type RollcallStatus = "announced" | "open" | "planned" | "closed";

export interface Rollcall {
  id: string;
  date: string; // YYYY-MM-DD
  forecastCm: number; // 予報の降雪量
  status: RollcallStatus;
  /** 今朝の雪の名前（前夜の予告で Claude がつける。雪HPバーに出す） */
  snowName?: string;
}

/** 依頼者の答え: はい（出られる）／いいえ／一緒なら */
export type RequesterAnswer = "yes" | "no" | "together";
/** 手伝う側の答え: 動ける分数 */
export type HelperAnswer = 0 | 5 | 15 | 30 | 60;

export interface RollcallAnswer {
  rollcallId: string;
  participantId: string;
  answer: RequesterAnswer | HelperAnswer;
  answeredAt: string; // ISO
}

// ---- ミッションと小タスク ----
export type SubTaskKind = "path" | "sand" | "dump" | "garage" | "road" | "scout" | "supply";

export interface SubTask {
  id: string;
  kind: SubTaskKind;
  label: string; // 例: 玄関前の通路
  minutes: 5 | 15 | 30;
}

export type MissionStatus =
  | "open" // 人を待っている
  | "short" // 人手不足（赤点滅）
  | "assigned" // 必要人数がそろった
  | "in_progress" // 現地で作業中
  | "done" // 完了（建物をチーム色で塗る）
  | "no_answer"; // 点呼に返事がない（灰点滅・見守り）

export interface Mission {
  id: string;
  rollcallId: string;
  baseId: string;
  importance: number; // 大きいほど優先
  requiredPeople: number;
  subtasks: SubTask[];
  status: MissionStatus;
  startAt: string; // ISO
  /** 司令官の理由（30字、v1.1）。地図の「自分の割り当て」と /admin に出す */
  reason?: string;
  /** この家でどけた雪の目安 kg（カード発行時に Claude が推定、v1.2）。町内の合計に使う */
  snowKg?: number;
}

// ---- 出撃 ----
export type SortieStatus = "going" | "done";

/** 雪質（v1.2）: 粉雪／湿り雪／凍った雪／わからない */
export type SnowType = "powder" | "wet" | "icy" | "unknown";

export interface PhotoCheck {
  cleared: boolean; // 雪が除かれているか
  passable: boolean; // 通路が通れるか
  icy: boolean; // 凍結が残っているか
  comment: string;
  /** 写真では判断できない（暗い・ぼやけ・範囲が狭い）。報告として受け付ける（v1.1） */
  uncertain?: boolean;
  /** 写真から見える雪質（v1.2）。カードの排雪 kg と労いの文に使う */
  snowType?: SnowType;
  /** 労いの一言（30字、v1.2）。体調の判断はしない */
  care?: string;
}

export interface Sortie {
  id: string;
  missionId: string;
  participantId: string;
  teamId: TeamId;
  subtaskIds: string[];
  status: SortieStatus;
  /** 赤点滅の家に、自分の割り当て完了後に駆けつけたか */
  rescue: boolean;
  /** 「行く」を押した時刻 */
  confirmedAt?: string; // ISO
  photoUrl?: string;
  photoCheck?: PhotoCheck;
  completedAt?: string; // ISO
}

// ---- 得点 ----
export type ScoreReason =
  | "mission_done" // 10
  | "early" // +5（7:30 まで）
  | "rescue" // +10
  | "flock" // 同じチーム2人以上 各+5
  | "mixed" // 2チーム合流 両チーム+5
  | "scout" // 3
  | "supply" // 3
  | "requester_joined" // 3
  | "weekly_goal"; // チーム全員+20

export interface ScoreEvent {
  id: string;
  teamId: TeamId;
  participantId?: string;
  points: number;
  reason: ScoreReason;
  at: string; // ISO
}

// ---- カード ----
export type CardStyle = "kawaii" | "retrowave" | "kirie" | "pixel" | "eijin";

export interface Card {
  id: string;
  recipientId: string;
  rollcallId: string;
  missionId: string;
  serial: number; // No.007
  issuedCount: number; // その朝の発行枚数（二度と増えない）
  designName: string; // 玄関までの三十歩
  designNameEn: string; // Thirty Steps to the Door
  rarityLabel: string; // 早朝の群れ
  stars: 1 | 2 | 3;
  style: CardStyle;
  snowKg: number;
  snowKgComparison: string; // 軽トラ1台分
  memberNames: string[];
  teamIds: TeamId[];
  createdAt: string; // ISO
}

// ---- ソロ出動（v1.3）: 1人でもできる 3〜5分のミッション。羽ポイントはチーム得点と別の「個人の記録」 ----
/** ソロミッションの種類（bonus_* は連続出動などのごほうび） */
export type SoloKind =
  | "patrol" // 雪の状況を見回る（5分・現地）
  | "report_snow" // 雪の多い場所を報告（5分・現地・写真任意）
  | "check_spot" // 雪かき可能な場所を確認（5分・現地）
  | "help_house" // 1軒の雪かきを手伝う（既存のミッション完了で 10羽）
  | "find_help" // 仲間が必要な家を確認（5分・現地）
  | "own_house" // 自分の家の雪かき（5分・現地・写真任意）
  | "check_area" // 地域の状況を確認（3分・オンライン）
  | "report_online" // 雪の状況を一言で報告（3分・オンライン）
  | "find_online" // 助けが必要な場所を発見（3分・オンライン）
  | "bonus_first" // 初回出動
  | "bonus_streak3" // 3日連続出動
  | "bonus_streak5"; // 5日連続出動

/** ソロ活動の台帳の1行。date はアプリの「今日」（lib/morning/today.ts）。オンラインの活動は雪かき完了にはしない */
export interface SoloLog {
  id: string;
  participantId: string;
  date: string; // YYYY-MM-DD
  kind: SoloKind;
  onsite: boolean;
  feathers: number;
  note?: string;
  /** Claude のひとこと（30字、キーなしは定型） */
  hitokoto?: string;
  /** 写真を Claude が確認できたか（写真任意のミッションだけ） */
  photoChecked?: boolean;
  /** 活動した 50m マス（本人の家のマス。現地のときだけ） */
  cellKey?: string;
  /** 家の完了（help_house）のとき、そのミッション ID（同じ家で二重に数えない） */
  missionId?: string;
  at: string; // ISO
}
