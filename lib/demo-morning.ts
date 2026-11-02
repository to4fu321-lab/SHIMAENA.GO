// デモ用の固定状態: 2026-12-14（日）朝 7:10 ごろ、予報 12cm。
// 拠点1〜8 がいろいろな状態になっている。人物はすべて架空。
import type { MorningState } from "./morning";
import type { Mission, ScoreEvent, Sortie, TeamId } from "./types";

const rollcall = { id: "rc-20261214", date: "2026-12-14", forecastCm: 12, status: "planned" as const };
const at = (hm: string) => `2026-12-14T${hm}:00+09:00`;

const mission = (n: number, status: Mission["status"], requiredPeople: number, importance: number): Mission => ({
  id: `m${n}`,
  rollcallId: rollcall.id,
  baseId: `base${n}`,
  importance,
  requiredPeople,
  subtasks: [],
  status,
  startAt: at("07:00"),
});

const missions: Mission[] = [
  mission(1, "done", 2, 6),
  mission(2, "done", 3, 9),
  mission(3, "short", 3, 9),
  mission(4, "in_progress", 2, 5),
  mission(5, "assigned", 2, 4),
  mission(6, "no_answer", 2, 7),
  mission(7, "open", 1, 2),
  mission(8, "done", 1, 3),
];

let sortieNo = 0;
const sortie = (missionNo: number, participantId: string, teamId: TeamId, done: boolean): Sortie => ({
  id: `s${++sortieNo}`,
  missionId: `m${missionNo}`,
  participantId,
  teamId,
  subtaskIds: [],
  status: done ? "done" : "going",
  rescue: false,
  completedAt: done ? at("07:05") : undefined,
});

const sorties: Sortie[] = [
  sortie(1, "h1", "salvia", true),
  sortie(1, "h4", "salvia", true),
  sortie(2, "h2", "marigold", true),
  sortie(2, "h3", "lupinus", true),
  sortie(2, "h6", "lupinus", true),
  sortie(3, "h7", "salvia", false),
  sortie(4, "h9", "lupinus", false),
  sortie(4, "h12", "lupinus", false),
  sortie(5, "h5", "marigold", false),
  sortie(5, "h8", "marigold", false),
  sortie(8, "h11", "marigold", true),
];

let scoreNo = 0;
const score = (teamId: TeamId, points: number, reason: ScoreEvent["reason"]): ScoreEvent => ({
  id: `e${++scoreNo}`,
  teamId,
  points,
  reason,
  at: at("07:05"),
});

const scores: ScoreEvent[] = [
  score("salvia", 20, "mission_done"),
  score("salvia", 10, "early"),
  score("salvia", 10, "flock"),
  score("marigold", 10, "mission_done"),
  score("marigold", 5, "early"),
  score("marigold", 5, "mixed"),
  score("lupinus", 20, "mission_done"),
  score("lupinus", 10, "early"),
  score("lupinus", 10, "flock"),
  score("lupinus", 5, "mixed"),
  score("marigold", 10, "mission_done"),
  score("marigold", 5, "early"),
];

export const DEMO_MORNING: MorningState = { rollcall, missions, sorties, scores, viewerId: "h7" };
