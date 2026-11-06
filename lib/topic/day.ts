// 今日の話題（spec v1.23）: カードの挿絵と名前の材料になる「その時の時事」。1日1回だけ調べて、日付ごとに残す。
// ・キーあり: Claude が Web 検索で、その日の札幌・北海道の明るい話題（季節・行事・天気・地域の催し）を探し、短い名前と絵の手がかりにする
// ・キーなし／失敗／話題がない: 暦（二十四節気・年中行事、lib/topic/calendar.ts）
// 災害・事故・事件・病気・政治・人の名前・会社や商品の名前は、Claude への指示とプログラムの点検の両方ではじく。
import { z } from "zod";
import { hasDb, query } from "../db";
import { askJson, askWithWebSearch, hasClaudeKey } from "../claude/client";
import { recordProblem } from "../ops/problems";
import { calendarTopics, type MotifHint } from "./calendar";

export interface TopicItem {
  /** カードに出す名前（10字まで） */
  label: string;
  /** 挿絵の手がかり（30字まで。何をどう描くか） */
  hint: string;
  /** キーなしで描くときの絵の種類 */
  motif: MotifHint;
}

export interface DayTopic {
  date: string;
  items: TopicItem[];
  /** web = Claude が Web で調べた、calendar = 暦 */
  by: "web" | "calendar";
  at: string;
}

export const LABEL_MAX = 10;
export const HINT_MAX = 30;

/** 話題に出してはいけないことば（Claude の答えをプログラムでも点検する） */
const NG =
  /災害|地震|津波|噴火|火事|火災|事故|事件|死|亡|殺|逮捕|容疑|被害|遭難|行方不明|病|感染|ウイルス|インフル|コロナ|選挙|政治|政党|首相|大臣|知事|議会|戦争|紛争|軍|ミサイル|テロ|訴訟|裁判|倒産|値上げ|株価|不祥事|停電|欠航|運休|通行止め|クマ|熊|さん$|氏$/;

export function safeTopic(t: { label?: string; hint?: string }): boolean {
  const label = (t.label ?? "").trim();
  const hint = (t.hint ?? "").trim();
  if (!label || label.length > LABEL_MAX) return false;
  if (NG.test(label) || NG.test(hint)) return false;
  if (/[A-Za-z]{4,}/.test(label)) return false; // 会社名・商品名らしい英字はださない
  if (/\d{3,}/.test(label)) return false; // 番地・電話などの長い数字
  return true;
}

const MOTIFS = ["crystal", "yuzu", "tree", "bell", "kadomatsu", "mochi", "oni", "heart", "hina", "lantern", "leaf", "moon"] as const;

const TopicSchema = z.object({
  topics: z.array(
    z.object({
      label: z.string(),
      hint: z.string(),
      motif: z.enum(MOTIFS),
    }),
  ),
});

function calendarDay(date: string): DayTopic {
  return { date, items: calendarTopics(date).map((t) => ({ label: t.label, hint: `${t.label}を思わせる小さな絵`, motif: t.motif })), by: "calendar", at: new Date().toISOString() };
}

/** Claude が Web で調べる（キーがあるときだけ呼ぶ） */
async function searchDay(date: string): Promise<TopicItem[]> {
  const [, m, d] = date.split("-").map(Number);
  const notes = await askWithWebSearch(
    `${m}月${d}日ごろの、札幌・北海道の「明るい話題」を Web で調べて、3〜5個、短く箇条書きにしてください。` +
      "たとえば季節の行事、初雪や雪景色、冬の催し（雪まつり・イルミネーション・市場の旬の食べもの）、二十四節気、その日の記念日。" +
      "災害・事故・事件・病気・政治・お金のニュース、人の名前、会社や商品の名前は書かないでください。見つからなければ、その時期の季節の話題でかまいません。",
    { maxUses: 3 },
  );
  const res = await askJson({
    task:
      "下の「調べたメモ」から、雪かきのお礼のカードの挿絵にできる話題を 1〜3 個選んでください。採点表 cardArt の topic の規則に従います。" +
      `label は日本語 ${LABEL_MAX} 字まで（例: さっぽろ雪まつり準備・冬至のゆず湯・初雪の朝）、hint はその話題を小さな絵にするなら何を描くか（${HINT_MAX} 字まで）、` +
      "motif はプログラムの絵を使うときの近い種類。明るくない話題・人や会社の名前が入るものは選びません。",
    input: { date, notes: notes.slice(0, 4000) },
    schema: TopicSchema,
    model: "light",
  });
  return res.topics
    .map((t) => ({ label: t.label.trim().slice(0, LABEL_MAX), hint: t.hint.trim().slice(0, HINT_MAX), motif: t.motif }))
    .filter(safeTopic)
    .slice(0, 3);
}

// ---- 保存（日付ごと。DB があれば day_topics 表、なければメモリ） ----
const TABLE = "create table if not exists day_topics (date text primary key, topic jsonb not null, at timestamptz not null default now())";
let ready: Promise<unknown> | undefined;
const g = globalThis as { __shimaenaTopics?: Map<string, DayTopic>; __shimaenaTopicPending?: Map<string, Promise<DayTopic>> };
const mem = () => (g.__shimaenaTopics ??= new Map());
const pending = () => (g.__shimaenaTopicPending ??= new Map());

async function load(date: string): Promise<DayTopic | undefined> {
  if (!hasDb()) return mem().get(date);
  try {
    await (ready ??= query(TABLE));
    const rows = await query<{ topic: DayTopic }>("select topic from day_topics where date = $1", [date]);
    return rows[0]?.topic;
  } catch (e) {
    ready = undefined;
    await recordProblem("topic/load", e);
    return mem().get(date);
  }
}

async function save(t: DayTopic): Promise<void> {
  mem().set(t.date, t);
  if (!hasDb()) return;
  try {
    await (ready ??= query(TABLE));
    await query(
      "insert into day_topics (date, topic, at) values ($1, $2::jsonb, now()) on conflict (date) do update set topic = excluded.topic, at = now()",
      [t.date, JSON.stringify(t)],
    );
  } catch (e) {
    ready = undefined;
    await recordProblem("topic/save", e);
  }
}

/** 調べて残す（同じ日に何度呼んでも、調べるのは1回） */
export async function warmDayTopic(date: string): Promise<DayTopic> {
  const have = await load(date);
  if (have) return have;
  const p = pending().get(date);
  if (p) return p;
  const job = (async () => {
    let t = calendarDay(date);
    if (hasClaudeKey()) {
      try {
        const items = await searchDay(date);
        if (items.length > 0) t = { date, items, by: "web", at: new Date().toISOString() };
      } catch (e) {
        await recordProblem("topic/search", e);
      }
    }
    await save(t);
    return t;
  })().finally(() => pending().delete(date));
  pending().set(date, job);
  return job;
}

/**
 * カードを作るときに使う今日の話題。まだ調べていなければ調べるが、待つのは waitMs まで（雪かきの完了を待たせない）。
 * 間に合わなければ暦の話題で描く（調べた結果は次のカードから使う）
 */
export async function dayTopic(date: string, waitMs = 20_000): Promise<DayTopic> {
  const have = await load(date);
  if (have) return have;
  const job = warmDayTopic(date);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<DayTopic>((resolve) => (timer = setTimeout(() => resolve(calendarDay(date)), waitMs)));
  return Promise.race([job, timeout]).finally(() => clearTimeout(timer));
}
