// 隊長エージェント（spec v1.25）: 隊長トークの自由な文に、Claude が「アプリの道具」を自分で使って調べてから答える。
// 道具はどれも読むだけ（町の様子・天気・近くの家・道の報告・本人の記録・今できること）。
// 最後に answer で、返事と「1つの提案」を出す。提案は本人がボタンを押したときだけ、今までの決まった処理で実行する（AI が勝手に動かさない）。
// 調べた道具は「隊長が調べたこと」として吹き出しに出す（何を見て決めたかが分かる）。
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { COLORS } from "../brand";
import { CLAUDE_MODEL, getClaudeClient, hasClaudeKey, SYSTEM_PROMPT } from "../claude/client";
import { conciergeContext, conciergeWeather } from "../concierge/run";
import { optionAction } from "../concierge/messages";
import { buildOptions, BODY_WORDS } from "../concierge/options";
import { loadProfile } from "../concierge/profile";
import { distanceM } from "../game/help";
import { listThread } from "../inbox/store";
import { inboxKeyOf } from "../inbox/key";
import { bigButton } from "../line/flex";
import type { FlexMessage, LineMessage } from "../line/types";
import { jstHourMinute } from "../jst";
import { loadMorning } from "../morning/store";
import { loadRoster } from "../morning/roster";
import { appToday } from "../morning/today";
import { missingPeople } from "../morning/watch";
import { isNight } from "../night";
import { hazard } from "../road/hazards";
import { listRoadReportsSince } from "../road/store";
import { repo } from "../repo";
import { safetyLine } from "../safety";
import { stormStatus } from "../storm";
import { getTeam } from "../teams";
import { dayTopic } from "../topic/day";
import type { Participant } from "../types";

/** 道具の名前と、吹き出しに出す「調べたこと」 */
export const TOOL_LABEL: Record<string, string> = {
  look_town: "🗺 町の様子",
  find_houses: "🏠 近くの家",
  check_weather: "☁ 天気と安全",
  road_reports: "⚠ 道の報告",
  my_record: "📒 あなたの記録",
  list_activities: "📋 今できること",
};

const TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: "look_town", description: "今日の町の雪かきの全体（点呼の状態・家の数・終わった家・人手不足の家・今日の話題・夜か・警報で止まっているか）", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "find_houses",
    description: "この人の家から近い順に、手伝いが要る家（拠点の番号・距離 m・あと何人・どこまで雪かき・状態）。名前と住所は出ない",
    input_schema: { type: "object", properties: { maxDistanceM: { type: "number", description: "この距離までの家（既定 1000）" } }, additionalProperties: false },
  },
  { name: "check_weather", description: "町のいまの天気・気温・この先24時間の雪・積雪と、安全のひとこと", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "road_reports", description: "この人の家の近く（600m）の、ここ1日の道の危険の報告（種類・距離・何分前）", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "my_record", description: "この人の役割・チーム・今日もうやったこと・これまでのカードの枚数・向いている方向（つながり・運動・地域貢献・ゲーム）", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  { name: "list_activities", description: "この人がいま選べる活動の一覧（id・名前・分・点・どんな人向けか）。提案の activityId はここから選ぶ", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "answer",
    description: "最後に必ず1回呼ぶ。本人への返事と、1つの提案（なければ none）",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "返事（120字まで、やさしい日本語、隊長の口調）。調べた事実（距離・人数・気温など）を入れる" },
        kind: { type: "string", enum: ["join_house", "activity", "none"] },
        missionId: { type: "string", description: "join_house のとき、find_houses の missionId" },
        activityId: { type: "string", description: "activity のとき、list_activities の id" },
        button: { type: "string", description: "ボタンの文字（16字まで）" },
        why: { type: "string", description: "なぜこの提案か（40字まで、事実だけ）" },
      },
      required: ["text", "kind"],
      additionalProperties: false,
    },
  },
];

const AnswerSchema = z.object({
  text: z.string(),
  kind: z.enum(["join_house", "activity", "none"]),
  missionId: z.string().optional(),
  activityId: z.string().optional(),
  button: z.string().optional(),
  why: z.string().optional(),
});
type Answer = z.infer<typeof AnswerSchema>;

export interface AgentResult {
  messages: LineMessage[];
  /** 使った道具（順番どおり） */
  used: string[];
}

/** 道具を実行する（すべて読むだけ）。答えは JSON の文字列 */
export async function runTool(name: string, input: Record<string, unknown>, p: Participant, now: Date): Promise<string> {
  const record = await loadMorning();
  const m = record.morning;
  const today = appToday(record, now);
  const isToday = m.rollcall.date === today;
  switch (name) {
    case "look_town": {
      const storm = await stormStatus().catch(() => ({ stopped: false, names: [] as string[] }));
      const topic = await dayTopic(today, 3000).catch(() => undefined);
      return JSON.stringify({
        today,
        hour: Number(jstHourMinute(now).slice(11, 13)),
        night: isNight(now),
        stormStopped: storm.stopped,
        rollcall: isToday ? m.rollcall.status : "今日はまだ雪かきの呼びかけなし",
        snowCm: isToday ? m.rollcall.forecastCm : 0,
        snowName: isToday ? m.rollcall.snowName : undefined,
        houses: isToday ? m.missions.length : 0,
        done: isToday ? m.missions.filter((x) => x.status === "done").length : 0,
        short: isToday ? m.missions.filter((x) => x.status === "short").length : 0,
        peopleOut: isToday ? new Set(m.sorties.map((x) => x.participantId)).size : 0,
        topics: topic?.items.map((t) => t.label) ?? [],
      });
    }
    case "find_houses": {
      if (!isToday) return JSON.stringify({ houses: [], note: "今日は雪かきの家がまだありません" });
      const roster = await loadRoster();
      const max = Math.min(3000, Math.max(100, Number(input.maxDistanceM) || 1000));
      const mine = m.sorties.find((x) => x.participantId === p.id && x.status === "going");
      const houses = m.missions
        .filter((x) => x.status !== "done")
        .flatMap((x) => {
          const base = roster.bases.find((b) => b.id === x.baseId);
          const home = base && roster.participants.find((q) => q.id === base.requesterId);
          if (!base || !home || home.id === p.id) return [];
          const d = Math.round(distanceM(p.location, home.location) / 10) * 10;
          if (d > max) return [];
          return [{ missionId: x.id, number: base.number, distanceM: d, needMore: Math.max(0, missingPeople(record, x)), status: x.status, area: home.clearArea ?? "entrance", together: x.request?.note ?? "" }];
        })
        .sort((a, b) => b.needMore - a.needMore || a.distanceM - b.distanceM)
        .slice(0, 6);
      return JSON.stringify({ houses, myCurrent: mine ? m.missions.find((x) => x.id === mine.missionId)?.id : undefined });
    }
    case "check_weather": {
      const w = await conciergeWeather(now).catch(() => undefined);
      const rc = m.rollcall;
      const safety = isToday ? safetyLine({ cm: rc.forecastCm, tempMinC: rc.tempMinC, windMaxMs: rc.windMaxMs }) : undefined;
      return JSON.stringify({ ...(w ?? { now: "不明" }), ...(safety ? { safety } : {}) });
    }
    case "road_reports": {
      const since = new Date(now.getTime() - 24 * 3600000).toISOString();
      const reports = (await listRoadReportsSince(since).catch(() => []))
        .map((r) => ({ kind: hazard(r.hazard)?.label ?? r.hazard, distanceM: Math.round(distanceM(p.location, r.location) / 10) * 10, minutesAgo: Math.round((now.getTime() - Date.parse(r.at)) / 60000) }))
        .filter((r) => r.distanceM <= 600)
        .sort((a, b) => a.distanceM - b.distanceM)
        .slice(0, 5);
      return JSON.stringify({ reports });
    }
    case "my_record": {
      const r = repo();
      const [logs, cards, profile] = await Promise.all([
        r.listSoloLogsByParticipant(p.id).catch(() => []),
        r.listCardsByRecipient(p.id).catch(() => []),
        loadProfile(p.id).catch(() => undefined),
      ]);
      return JSON.stringify({
        role: p.role === "requester" ? "雪かきを頼む家（手伝うこともできる）" : "手伝う人",
        team: p.teamId ? getTeam(p.teamId).name : "なし",
        todayDone: logs.filter((l) => l.date === today).map((l) => l.kind),
        cards: cards.length,
        activeDays: new Set(logs.map((l) => l.date)).size,
        motives: profile?.motives ?? [],
        goingNow: m.sorties.some((x) => x.participantId === p.id && x.status === "going"),
      });
    }
    case "list_activities": {
      const ctx = await conciergeContext(p, record, now);
      return JSON.stringify(buildOptions(ctx).map(({ id, title, minutes, points, about }) => ({ id, title, minutes, points, about })));
    }
    default:
      return JSON.stringify({ error: "知らない道具です" });
  }
}

/**
 * 隊長トークの直近のやり取り（文だけ・6件まで）。体のことばを含む文は伏せる。
 * 本人の今回の文は先に流れへ入ってから届くので、末尾が今回の文と同じなら落とす（「本人の文」で別に渡すため2回にしない）
 */
export function talkLines(items: { dir: string; body: unknown }[], current: string): string {
  const lines = items.flatMap((it) => {
    const b = it.body as { text?: unknown; altText?: unknown };
    const text = typeof b.text === "string" ? b.text : typeof b.altText === "string" ? b.altText : "";
    return text ? [{ dir: it.dir, text }] : [];
  });
  const last = lines.at(-1);
  if (last && last.dir === "in" && last.text.trim() === current.trim()) lines.pop();
  return lines
    .map((l) => `${l.dir === "in" ? "本人" : "隊長"}: ${BODY_WORDS.test(l.text) ? "（体のこと）" : l.text.slice(0, 80)}`)
    .slice(-6)
    .join("\n");
}

async function recentTalk(p: Participant, current: string): Promise<string> {
  const key = inboxKeyOf(p);
  if (!key) return "";
  const items = (await listThread(key, 20).catch(() => [])).slice(-8);
  return talkLines(items, current);
}

/** 指示の最初に書く「この人は誰か」（役割とチームの有無）。チームのない人には家の提案をさせない（ボタンが出ないため） */
export function whoLine(p: Pick<Participant, "role" | "teamId">): string {
  const role = p.role === "requester" ? "お願いする側（雪かきを頼む家の人）" : "手伝う側";
  const team = p.teamId ? getTeam(p.teamId).name : undefined;
  return team
    ? `この人: ${role}・${team}チーム。`
    : `この人: ${role}・チームなし。この人には join_house（よその家へ行く）を提案しません（押せるボタンが出ません）。`;
}

const TASK =
  "あなたは隊長トークでの「シマエナ隊長」です。本人の文に、まず道具で事実を調べてから答えてください（2〜4個の道具。同じ道具は1回まで）。" +
  "雪かき・見回り・町の様子・天気・道の危険・自分の記録・何をしたらいいか、の相談なら、調べた事実をもとに、いまのその人にいちばん合う1つを提案します。" +
  "夜（night）や警報（stormStopped）のときは、よその家をすすめません。体調・医療の判断はしません（体のことは「無理しないで」と家族や医療に）。" +
  "人の名前・住所は出しません（拠点の番号と距離だけ）。最後に必ず answer を呼びます。answer の text は120字まで、事実の数字を入れ、採点表 voice の口調で。";

/** 隊長エージェントで答える。失敗したら例外（呼ぶ側が今までのコンシェルジュに切りかえる） */
export async function captainAgent(p: Participant, text: string, now = new Date()): Promise<AgentResult> {
  const client = getClaudeClient();
  const history = await recentTalk(p, text);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `${whoLine(p)}\n${TASK}\n\n直近のやり取り:\n${history || "（なし）"}\n\n本人の文: ${text.slice(0, 300)}` },
  ];
  const used: string[] = [];
  let answer: Answer | undefined;
  for (let turn = 0; turn < 6 && !answer; turn++) {
    const res = await client.beta.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      output_config: { effort: "medium" },
      tools: TOOLS,
      messages,
    });
    if (res.stop_reason === "refusal") throw new Error("Claude がこの依頼を断りました");
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (calls.length === 0) {
      const t = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
      answer = { text: t || "ごめんなさい、うまく調べられませんでした。もう一度送ってください。", kind: "none" };
      break;
    }
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const c of calls) {
      if (c.name === "answer") {
        const a = AnswerSchema.safeParse(c.input);
        if (a.success) answer = a.data;
        results.push({ type: "tool_result", tool_use_id: c.id, content: a.success ? "ok" : "形がちがいます", ...(a.success ? {} : { is_error: true }) });
        continue;
      }
      if (!used.includes(c.name)) used.push(c.name);
      const out = await runTool(c.name, (c.input ?? {}) as Record<string, unknown>, p, now).catch((e) => JSON.stringify({ error: e instanceof Error ? e.message : String(e) }));
      results.push({ type: "tool_result", tool_use_id: c.id, content: out });
    }
    if (!answer) messages.push({ role: "user", content: results });
  }
  if (!answer) throw new Error("隊長エージェントが答えを出せませんでした");
  return { messages: await renderAnswer(p, answer, used, now), used };
}

/** 答えを吹き出しに。提案は確かめてから（家が今も手伝いを待っているか・夜でないか・候補の中にあるか）ボタンにする */
export async function renderAnswer(p: Participant, a: Answer, used: string[], now: Date): Promise<LineMessage[]> {
  const text = a.text.replace(/\s+/g, " ").trim().slice(0, 160);
  const trace = used.length > 0 ? `隊長が調べたこと: ${used.map((u) => TOOL_LABEL[u] ?? u).join(" ・ ")}` : "";
  let button: ReturnType<typeof bigButton> | undefined;
  const label = (a.button ?? "").trim().slice(0, 16);
  if (a.kind === "join_house" && a.missionId && !isNight(now)) {
    const record = await loadMorning();
    const mission = record.morning.missions.find((x) => x.id === a.missionId);
    const already = record.morning.sorties.some((x) => x.participantId === p.id && x.status === "going");
    if (mission && mission.status !== "done" && !already && p.teamId) {
      button = bigButton(label || "この家へ行く", { type: "postback", label: (label || "この家へ行く").slice(0, 20), data: `help:go=${mission.id}`, displayText: label || "この家へ行く" }, "main");
    }
  } else if (a.kind === "activity" && a.activityId) {
    const record = await loadMorning();
    const ctx = await conciergeContext(p, record, now);
    const o = buildOptions(ctx).find((x) => x.id === a.activityId);
    if (o) button = bigButton(label || o.button, optionAction({ ...o, button: label || o.button }), "main");
  }
  const why = (a.why ?? "").replace(/\s+/g, " ").trim().slice(0, 40);
  const card: FlexMessage = {
    type: "flex",
    altText: text.slice(0, 400),
    contents: {
      type: "bubble",
      size: "giga",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "20px",
        contents: [
          ...(trace ? [{ type: "text" as const, text: trace, size: "sm" as const, color: COLORS.winter, wrap: true }] : []),
          { type: "text" as const, text, size: "lg" as const, weight: "bold" as const, color: COLORS.ink, wrap: true },
          ...(why && button ? [{ type: "text" as const, text: `💡 ${why}`, size: "md" as const, color: COLORS.winter, wrap: true }] : []),
          ...(button ? [button] : []),
        ],
      },
    },
  };
  return [card];
}

/**
 * 隊長トークの自由な文の入口（spec v1.25）: キーがあれば隊長エージェント、なければ・失敗したら今までのコンシェルジュ。
 * 登録していない人は null（登録の会話へ）
 */
export async function captainReply(
  lineUserId: string,
  text: string,
  fallback: (lineUserId: string, text: string) => Promise<LineMessage[] | null>,
  now = new Date(),
): Promise<LineMessage[] | null> {
  const p = await repo().findParticipantByLineUserId(lineUserId);
  if (!p || (p.role !== "helper" && p.role !== "requester") || !hasClaudeKey()) return fallback(lineUserId, text);
  try {
    return (await captainAgent(p, text, now)).messages;
  } catch (e) {
    console.error("[agent] 隊長エージェントに失敗（コンシェルジュで答えます）:", e instanceof Error ? e.message : e);
    return fallback(lineUserId, text);
  }
}
