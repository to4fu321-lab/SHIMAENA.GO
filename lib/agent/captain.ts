// 隊長エージェント（spec v1.25）: 隊長トークの自由な文に、Claude が「アプリの道具」を自分で使って調べてから答える。
// 道具はどれも読むだけ（町の様子・天気・近くの家・道の報告・本人の記録・今できること）。
// 最後に answer で、返事と「1つの提案」を出す。提案は本人がボタンを押したときだけ、今までの決まった処理で実行する（AI が勝手に動かさない）。
// 調べた道具は「隊長が調べたこと」として吹き出しに出す（何を見て決めたかが分かる）。
// 速さ（spec v1.42。11/8 本人の指摘「チャットが遅い。今の5倍は速く」）: 前は Opus が道具を1つずつ呼んで最大6往復していた（1回 15〜30 秒）。
// いまは道具（どれも読むだけで速い）をサーバーで全部いっしょに調べてから、速いモデル（Haiku）に1回だけ聞く。
// 隊長は事実の中から使ったものを used で返し、それを「隊長が調べたこと」に出す。CAPTAIN_CHAT_MODEL=main で Opus に戻せる。
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { COLORS } from "../brand";
import { CLAUDE_LIGHT_MODEL, CLAUDE_MODEL, getClaudeClient, hasClaudeKey, SYSTEM_PROMPT } from "../claude/client";
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
import type { MorningRecord } from "../morning/flow";
import type { Roster } from "../morning/roster";
import { progress } from "../morning/view";
import { listShort, missingPeople, nextHouseOf, viewerSpot } from "../morning/watch";
import { checkAnswerText, houseLine, nearestHouse, safeText, type HouseFact, type TownFact, type VerifyContext } from "./verify";
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

/** 先にまとめて調べる事実（どれも読むだけ）。answer 以外の道具の名前 */
const FACT_NAMES = ["look_town", "find_houses", "check_weather", "road_reports", "my_record", "list_activities"];

const TOOLS: Anthropic.Beta.BetaTool[] = [
  { name: "look_town", description: "今日の町の雪かきの全体（点呼の状態・家の数・終わった家・人手不足の家・今日の話題・夜か・警報で止まっているか）", input_schema: { type: "object", properties: {}, additionalProperties: false } },
  {
    name: "find_houses",
    description: "この人のいまの場所から近い順に、手伝いが要る家（拠点の番号・距離 m・あと何人・どこまで雪かき・状態・nearest=いちばん近い家）と、おすすめの1軒（recommend）。名前と住所は出ない",
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
        used: { type: "array", items: { type: "string", enum: FACT_NAMES }, description: "返事と提案に使った事実の名前（1〜4個）" },
      },
      required: ["text", "kind", "used"],
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
  used: z.array(z.string()).optional(),
});
type Answer = z.infer<typeof AnswerSchema>;

export interface AgentResult {
  messages: LineMessage[];
  /** 使った道具（順番どおり） */
  used: string[];
}

/** 町の今朝の数（地図・町のページと同じ数え方）。今日の呼びかけがなければ全部 0 */
export function townFact(record: MorningRecord, today: string): TownFact {
  const m = record.morning;
  if (m.rollcall.date !== today) return { houses: 0, done: 0, left: 0, short: 0, peopleOut: 0, snowCm: 0 };
  const prog = progress(m);
  return {
    houses: prog.total,
    done: prog.done,
    left: prog.left,
    short: m.missions.filter((x) => x.status === "short").length,
    peopleOut: new Set(m.sorties.filter((x) => x.status === "going").map((x) => x.participantId)).size,
    snowCm: m.rollcall.forecastCm,
  };
}

/** まだ終わっていない家（自分の家は除く）。距離は地図と同じ: いまいる場所（さっき終えた家 → なければ自分の家）から、50m きざみ */
export function houseFacts(record: MorningRecord, roster: Roster, p: Participant): HouseFact[] {
  const from = viewerSpot(record, roster, p.id) ?? p.location;
  return record.morning.missions
    .filter((x) => x.status !== "done")
    .flatMap((x) => {
      const base = roster.bases.find((b) => b.id === x.baseId);
      const home = base && roster.participants.find((q) => q.id === base.requesterId);
      if (!base || !home || home.id === p.id) return [];
      return [{ missionId: x.id, number: base.number, distanceM: Math.max(50, Math.round(distanceM(from, home.location) / 50) * 50), needMore: Math.max(0, missingPeople(record, x)), status: x.status }];
    });
}

/** おすすめの1軒（地図の「次の1軒」と同じ）: 人手が足りない家のうち、いちばん近い家。自分の家・もう向かっている家は除く */
export function recommendHouse(record: MorningRecord, roster: Roster, p: Participant): HouseFact | undefined {
  const facts = houseFacts(record, roster, p);
  const mine = new Set(record.morning.sorties.filter((x) => x.participantId === p.id && x.status === "going").map((x) => x.missionId));
  const next = nextHouseOf(listShort(record, roster, viewerSpot(record, roster, p.id) ?? p.location).filter((h) => !mine.has(h.missionId) && facts.some((f) => f.missionId === h.missionId)));
  return next ? facts.find((f) => f.missionId === next.missionId) : undefined;
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
      const t = townFact(record, today);
      return JSON.stringify({
        today,
        hour: Number(jstHourMinute(now).slice(11, 13)),
        night: isNight(now),
        stormStopped: storm.stopped,
        rollcall: isToday ? m.rollcall.status : "今日はまだ雪かきの呼びかけなし",
        snowCm: t.snowCm,
        snowName: isToday ? m.rollcall.snowName : undefined,
        // 数え方は地図・町のページと同じ（lib/agent/verify.ts の TownFact）
        houses: t.houses,
        done: t.done,
        left: t.left,
        short: t.short,
        peopleOut: t.peopleOut,
        topics: topic?.items.map((t) => t.label) ?? [],
      });
    }
    case "find_houses": {
      if (!isToday) return JSON.stringify({ houses: [], note: "今日は雪かきの家がまだありません" });
      const roster = await loadRoster();
      const max = Math.min(3000, Math.max(100, Number(input.maxDistanceM) || 1000));
      const mine = m.sorties.find((x) => x.participantId === p.id && x.status === "going");
      const all = houseFacts(record, roster, p);
      const nearest = nearestHouse(all);
      const rec = recommendHouse(record, roster, p);
      const houses = all
        .filter((h) => h.distanceM <= max)
        .map((h) => {
          const x = m.missions.find((y) => y.id === h.missionId);
          const home = roster.participants.find((q) => q.id === roster.bases.find((b) => b.id === x?.baseId)?.requesterId);
          return { ...h, nearest: h.missionId === nearest?.missionId, area: home?.clearArea ?? "entrance", together: x?.request?.note ?? "" };
        })
        .sort((a, b) => a.distanceM - b.distanceM || b.needMore - a.needMore)
        .slice(0, 6);
      return JSON.stringify({
        houses,
        // おすすめの1軒: 地図の「次の1軒」と同じ決め方（人手が足りない家のうち、いちばん近い家）
        recommend: rec ? { missionId: rec.missionId, number: rec.number, distanceM: rec.distanceM, needMore: rec.needMore } : undefined,
        myCurrent: mine ? m.missions.find((x) => x.id === mine.missionId)?.id : undefined,
      });
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
  "あなたは隊長トークでの「シマエナ隊長」です。下の「調べた事実」（アプリの道具の結果）をもとに、本人の文に answer で答えてください。" +
  "雪かき・見回り・町の様子・天気・道の危険・自分の記録・何をしたらいいか、の相談なら、事実をもとに、いまのその人にいちばん合う1つを提案します。" +
  "夜（night）や警報（stormStopped）のときは、よその家をすすめません。体調・医療の判断はしません（体のことは「無理しないで」と家族や医療に）。" +
  "人の名前・住所は出しません（拠点の番号と距離だけ）。answer の text は120字まで、事実の数字を入れ、採点表 voice の口調で。used には使った事実の名前を入れます。" +
  "数字は事実のとおりに書きます（計算したり、丸めたり、作ったりしない）: 人手が足りない家の数は look_town.short、終わった家は done、のこりは left。" +
  "家をすすめるときは find_houses.recommend の家を1つだけ（missionId もその家）。text に書く拠点の番号・距離・あと何人は、その家の number・distanceM・needMore と同じにします。「いちばん近い」と書けるのは nearest の家だけです。" +
  "返事はプログラムが事実と照らして点検します。合わない数字があると、その返事は使われません。";

/** 隊長トークに使うモデル。既定は速い Haiku、CAPTAIN_CHAT_MODEL=main で Opus */
export function captainChatModel(env: Readonly<Record<string, string | undefined>> = process.env): string {
  return env.CAPTAIN_CHAT_MODEL?.trim() === "main" ? CLAUDE_MODEL : CLAUDE_LIGHT_MODEL;
}

/** 道具を全部いっしょに調べる（どれも読むだけ）。失敗した道具は error を入れて続ける */
export async function gatherFacts(p: Participant, now: Date): Promise<Record<string, unknown>> {
  const outs = await Promise.all(
    FACT_NAMES.map((n) =>
      runTool(n, {}, p, now)
        .then((o) => JSON.parse(o) as unknown)
        .catch((e) => ({ error: e instanceof Error ? e.message : String(e) })),
    ),
  );
  return Object.fromEntries(FACT_NAMES.map((n, i) => [n, outs[i]]));
}

/** 隊長エージェントで答える。失敗したら例外（呼ぶ側が今までのコンシェルジュに切りかえる） */
export async function captainAgent(p: Participant, text: string, now = new Date()): Promise<AgentResult> {
  const client = getClaudeClient();
  const [history, facts] = await Promise.all([recentTalk(p, text), gatherFacts(p, now)]);
  const model = captainChatModel();
  const main = model === CLAUDE_MODEL;
  const res = await client.beta.messages.create({
    model,
    max_tokens: 2000,
    // 安全のための自動判定で断られたときに別のモデルで続ける仕組みは Opus だけ
    ...(main ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    output_config: { effort: "low" },
    tools: TOOLS.filter((x) => x.name === "answer"),
    tool_choice: { type: "tool", name: "answer" },
    messages: [
      {
        role: "user",
        content: `${whoLine(p)}\n${TASK}\n\n調べた事実（JSON）:\n${JSON.stringify(facts)}\n\n直近のやり取り:\n${history || "（なし）"}\n\n本人の文: ${text.slice(0, 300)}`,
      },
    ],
  });
  if (res.stop_reason === "refusal") throw new Error("Claude がこの依頼を断りました");
  const call = res.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === "answer");
  const a = AnswerSchema.safeParse(call?.input);
  if (!a.success) throw new Error("隊長エージェントが答えを出せませんでした");
  const used = (a.data.used ?? []).filter((u, i, all) => FACT_NAMES.includes(u) && all.indexOf(u) === i).slice(0, 4);
  return { messages: await renderAnswer(p, a.data, used, now), used };
}

/** 点検に使う事実（地図・ボタンと同じデータ）。proposal はあとで入れる */
async function verifyContext(p: Participant, record: MorningRecord, now: Date): Promise<VerifyContext> {
  const roster = await loadRoster();
  const today = appToday(record, now);
  const isToday = record.morning.rollcall.date === today;
  const w = await conciergeWeather(now).catch(() => undefined);
  const rc = record.morning.rollcall;
  return {
    town: townFact(record, today),
    houses: isToday ? houseFacts(record, roster, p) : [],
    knownNumbers: isToday ? record.morning.missions.flatMap((x) => roster.bases.find((b) => b.id === x.baseId)?.number ?? []) : [],
    weatherNumbers: [w?.tempC, w?.snowNext24hCm, w?.depthCm, isToday ? rc.tempMinC : undefined, isToday ? rc.windMaxMs : undefined].filter((x): x is number => typeof x === "number"),
  };
}

/**
 * 答えを吹き出しに。提案は確かめてから（家が今も手伝いを待っているか・夜でないか・候補の中にあるか）ボタンにする。
 * 本文の数字は点検する（spec v1.59）: 拠点の番号・あと何人・距離・軒数がボタンや地図のデータと合わなければ、プログラムが組んだ文に差しかえる。
 */
export async function renderAnswer(p: Participant, a: Answer, used: string[], now: Date): Promise<LineMessage[]> {
  let text = a.text.replace(/\s+/g, " ").trim().slice(0, 160);
  const trace = used.length > 0 ? `隊長が調べたこと: ${used.map((u) => TOOL_LABEL[u] ?? u).join(" ・ ")}` : "";
  let button: ReturnType<typeof bigButton> | undefined;
  const label = (a.button ?? "").trim().slice(0, 16);
  const record = await loadMorning();
  const ctx = await verifyContext(p, record, now);
  if (a.kind === "join_house" && a.missionId && !isNight(now)) {
    const mission = record.morning.missions.find((x) => x.id === a.missionId);
    const already = record.morning.sorties.some((x) => x.participantId === p.id && x.status === "going");
    const fact = ctx.houses.find((h) => h.missionId === a.missionId);
    if (mission && mission.status !== "done" && !already && p.teamId && fact) {
      ctx.proposal = fact;
      // ボタンの文字の番号も、プログラムが入れる（「拠点6に行く」が別の家を指さないように）
      const fixed = /拠点/.test(label) ? `拠点${fact.number}へ行く` : label || "この家へ行く";
      button = bigButton(fixed, { type: "postback", label: fixed.slice(0, 20), data: `help:go=${mission.id}`, displayText: fixed }, "main");
    }
  } else if (a.kind === "activity" && a.activityId) {
    const cctx = await conciergeContext(p, record, now);
    const o = buildOptions(cctx).find((x) => x.id === a.activityId);
    if (o) button = bigButton(label || o.button, optionAction({ ...o, button: label || o.button }), "main");
  }
  const problems = checkAnswerText(text, ctx);
  if (problems.length > 0) {
    console.warn(`[agent] 返事の数字が事実と合わないので、プログラムの文に差しかえます: ${problems.join(" / ")}`);
    text = safeText(ctx);
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
          ...(why && button && problems.length === 0 ? [{ type: "text" as const, text: `💡 ${why}`, size: "md" as const, color: COLORS.winter, wrap: true }] : []),
          // ボタンの家の事実は、プログラムが書く（本文と同じデータ）
          ...(ctx.proposal ? [{ type: "text" as const, text: houseLine(ctx.proposal), size: "md" as const, weight: "bold" as const, color: COLORS.ink, wrap: true }] : []),
          ...(problems.length > 0 ? [{ type: "text" as const, text: "🔎 数字を点検して、地図と同じ数に直しました", size: "sm" as const, color: COLORS.winter, wrap: true }] : []),
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
