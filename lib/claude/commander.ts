// 司令官: 予報＋点呼の回答＋拠点＋手伝う人 → 重要度・割り当て・連絡文。spec 9-2。
import { z } from "zod";
import { distanceM } from "../game/help";
import { importance, requiredPeople } from "../game/mission";
import type { HelperAnswer, LatLng, RequesterAnswer, TeamId } from "../types";
import { askJson, hasClaudeKey } from "./client";

export interface CommanderInput {
  date: string; // YYYY-MM-DD
  forecastCm: number;
  startTime: string; // 例: 07:00
  bases: {
    baseId: string;
    number: number;
    level: 1 | 2 | 3;
    answer: RequesterAnswer | "none";
    location: LatLng;
    requesterName: string;
  }[];
  helpers: {
    id: string;
    nickname: string;
    teamId: TeamId;
    minutes: HelperAnswer;
    location: LatLng;
  }[];
}

/** 司令官の理由（1家1行）の長さ */
export const REASON_MAX = 30;

export const PlanSchema = z.object({
  missions: z.array(
    z.object({
      baseId: z.string(),
      importance: z.number(),
      requiredPeople: z.number().int(),
      assignedHelperIds: z.array(z.string()),
      status: z.enum(["assigned", "short", "no_answer"]),
      /** なぜその重要度・人数・その人たちか（30字まで、事実だけ。体調の話はしない）。地図と /admin に出す */
      reason: z.string(),
    }),
  ),
  /** 割り当てられた人それぞれへの LINE の文面 */
  messages: z.array(z.object({ participantId: z.string(), text: z.string() })),
  /** 町内みんなに出す今朝のまとめ（2〜3文） */
  briefing: z.string(),
});
export type Plan = z.infer<typeof PlanSchema>;

const TEAM_NAME: Record<TeamId, string> = { salvia: "サルビア", marigold: "マリーゴールド", lupinus: "ルピナス" };
const ANSWER_TEXT: Record<RequesterAnswer | "none", string> = { no: "出られない", together: "一緒にやる", yes: "出られる", none: "返事なし" };

/** 理由を1行・30字に整える（改行や余分な空白も消す） */
export function cleanReason(reason: string | undefined): string {
  return (reason ?? "").replace(/\s+/g, " ").trim().slice(0, REASON_MAX);
}

/** Claude が使えないときの理由: レベル・答え・人数の事実だけで作る */
function mockReason(base: CommanderInput["bases"][number], required: number, picked: number): string {
  const why = base.answer === "none" ? "返事なし。まず声かけ" : `${ANSWER_TEXT[base.answer]}・レベル${base.level}`;
  const who = picked >= required ? `近い${picked}人で` : `あと${required - picked}人、近所に声かけ`;
  return cleanReason(`${why} → ${required}人。${who}`);
}

/** Claude が使えないときの作戦（採点表と同じ規則を計算で行う） */
export function mockPlan(input: CommanderInput): Plan {
  const targets = input.bases
    .filter((b) => b.answer !== "yes")
    .map((b) => ({
      base: b,
      importance: importance(b.level, b.answer),
      required: requiredPeople(b.level, b.answer),
    }))
    .sort((a, b) => b.importance - a.importance);

  const free = new Map(input.helpers.filter((h) => h.minutes > 0).map((h) => [h.id, h]));
  const missions: Plan["missions"] = [];
  for (const t of targets) {
    const picked: CommanderInput["helpers"] = [];
    while (picked.length < t.required && free.size > 0) {
      const byDistance = [...free.values()].sort(
        (a, b) => distanceM(t.base.location, a.location) - distanceM(t.base.location, b.location),
      );
      let next = byDistance[0];
      // 2人目以降は、近さがほぼ同じ（+150m 以内）なら同じチームの人を選ぶ（群れボーナス）
      if (picked.length > 0) {
        const nearest = distanceM(t.base.location, next.location);
        const sameTeam = byDistance.find(
          (h) => h.teamId === picked[0].teamId && distanceM(t.base.location, h.location) <= nearest + 150,
        );
        if (sameTeam) next = sameTeam;
      }
      picked.push(next);
      free.delete(next.id);
    }
    missions.push({
      baseId: t.base.baseId,
      importance: t.importance,
      requiredPeople: t.required,
      assignedHelperIds: picked.map((h) => h.id),
      status: t.base.answer === "none" ? "no_answer" : picked.length >= t.required ? "assigned" : "short",
      reason: mockReason(t.base, t.required, picked.length),
    });
  }

  const messages: Plan["messages"] = [];
  for (const m of missions) {
    const base = input.bases.find((b) => b.baseId === m.baseId)!;
    for (const id of m.assignedHelperIds) {
      const others = m.assignedHelperIds
        .filter((o) => o !== id)
        .map((o) => {
          const h = input.helpers.find((x) => x.id === o)!;
          return `${TEAM_NAME[h.teamId]}の${h.nickname}さん`;
        });
      const withWho = others.length > 0 ? `${others.join("、")}と一緒だしま〜！` : "";
      const note =
        m.status === "no_answer"
          ? "点呼に返事がありません。まず玄関で声をかけてください。"
          : "5分でも助かるしま〜。足元に気をつけてえな〜！";
      messages.push({
        participantId: id,
        text: `おはようだしま〜！${input.startTime}、拠点${base.number}（${base.requesterName}）へお願いできるえな〜？${withWho}${note}`,
      });
    }
  }

  const short = missions.filter((m) => m.status === "short").length;
  const briefing =
    `エナガ隊長だしま〜！今朝の予報は${input.forecastCm}cm。${missions.length}軒を${input.startTime}から始めます。` +
    (short > 0 ? `人手が足りない家が${short}軒あります。5分だけでも、近くの人お願いします。` : "全部の家に人がそろいました。");
  return { missions, messages, briefing };
}

/**
 * Claude の作戦を点検する: 存在しない ID・二重割り当て・動けない人を外し、
 * 人数から状態を付け直す。点検後の作戦だけを保存に使う。
 */
/** 点検に入れる作戦。古い形（reason なし）も受け付ける */
export type PlanInput = Omit<Plan, "missions"> & {
  missions: (Omit<Plan["missions"][number], "reason"> & { reason?: string })[];
};

export function sanitizePlan(plan: PlanInput, input: CommanderInput): Plan {
  const helperOk = new Set(input.helpers.filter((h) => h.minutes > 0).map((h) => h.id));
  const baseById = new Map(input.bases.map((b) => [b.baseId, b]));
  const used = new Set<string>();
  const seenBase = new Set<string>();
  const missions: Plan["missions"] = [];
  for (const m of plan.missions) {
    const base = baseById.get(m.baseId);
    if (!base || base.answer === "yes" || seenBase.has(m.baseId)) continue;
    seenBase.add(m.baseId);
    const assigned: string[] = [];
    for (const id of m.assignedHelperIds) {
      // 同じ人が同じ家に2回・別の家にも書かれていたら、最初の1回だけ残す
      if (!helperOk.has(id) || used.has(id)) continue;
      used.add(id);
      assigned.push(id);
    }
    const required = Math.max(1, Math.min(3, Math.round(m.requiredPeople)));
    missions.push({
      baseId: m.baseId,
      importance: m.importance,
      requiredPeople: required,
      assignedHelperIds: assigned,
      status: base.answer === "none" ? "no_answer" : assigned.length >= required ? "assigned" : "short",
      reason: cleanReason(m.reason) || mockReason(base, required, assigned.length),
    });
  }
  const messages = plan.messages.filter((msg) => used.has(msg.participantId));
  return { missions, messages, briefing: plan.briefing };
}

export async function planMorning(input: CommanderInput): Promise<Plan> {
  if (!hasClaudeKey()) return mockPlan(input);
  const plan = await askJson({
    task:
      "雪の朝の点呼が終わりました。採点表の importance・requiredPeople・assignment の規則で、家ごとの重要度・必要人数・割り当てを決めてください。" +
      "「はい」と答えた家はミッションにしません。家ごとに reason（30字まで）を書きます: なぜその重要度・人数・その人たちなのかを、レベル・答え・距離・人数などの事実だけで。体調や医療の話は書きません。" +
      "割り当てた人それぞれに LINE の文面（3文以内、やさしい日本語、開始時刻と家の番号と依頼者の呼び名と一緒に行く人を含む。名乗らない）を書き、" +
      "町内みんなへのまとめ（2〜3文。採点表 voice のエナガ隊長の口調で、最初に「エナガ隊長だしま〜！」）も書いてください。",
    input,
    schema: PlanSchema,
    effort: "medium",
  });
  return sanitizePlan(plan, input);
}
