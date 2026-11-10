// 今朝の雪の歌（spec v1.28・採点表 song）: 1日1曲。その朝の事実から Claude が作曲し、プログラムが点検してから残す。
// キーなし・失敗・点検を通らないときは、プログラムが同じ事実から作曲する（lib/sound/snow-song.ts の composeFallback。毎朝ちがう）。
// 6:30 の処理で先に作り、ホームを開いたときにまだなければ返事のあとで作る（待たせない）。
import { z } from "zod";
import { askJsonLong, hasClaudeKey } from "../claude/client";
import { hasDb, query } from "../db";
import { addDays, jstMinutes } from "../jst";
import { loadMorning } from "../morning/store";
import { appToday } from "../morning/today";
import { recordProblem } from "../ops/problems";
import { composeFallback, moodOf, tidySong, BAR_CHOICES, BPM_MAX, BPM_MIN, EXPLAIN_MAX, MELODY_HIGH, MELODY_LOW, TITLE_MAX, type SnowSong, type SongFacts } from "../sound/snow-song";
import { dayTopic } from "../topic/day";
import { appNow } from "@/lib/clock";

const Note = z.object({ bar: z.number(), beat: z.number(), midi: z.number(), len: z.number() });
const SongSchema = z.object({
  title: z.string(),
  explain: z.string(),
  bpm: z.number(),
  bars: z.number(),
  groove: z.enum(["lofi", "drive", "ballad", "march"]),
  lead: z.enum(["bell", "epiano", "lead"]),
  chords: z.array(z.array(z.number())),
  bass: z.array(z.number()),
  melody: z.array(Note),
  sparkle: z.array(Note),
  wind: z.number(),
  crunch: z.boolean(),
});

/** その日の曲の材料を、今朝の状態と今日の話題から集める */
export async function songFacts(date: string, now = appNow()): Promise<SongFacts> {
  const s = await loadMorning();
  const rc = s.morning.rollcall;
  const same = rc.date === date && rc.status !== "closed";
  const topics = await dayTopic(date, 5_000).then((t) => t.items.map((x) => x.label), () => []);
  return {
    date,
    snowCm: same ? rc.forecastCm : 0,
    ...(same && rc.snowName ? { snowName: rc.snowName } : {}),
    ...(same && rc.tempMinC !== undefined ? { tempMinC: rc.tempMinC } : {}),
    ...(same && rc.windMaxMs !== undefined ? { windMaxMs: rc.windMaxMs } : {}),
    hour: Math.floor(jstMinutes(now) / 60),
    topics,
  };
}

/** Claude に作曲してもらう（点検を通らなければ undefined） */
async function composeByClaude(f: SongFacts): Promise<SnowSong | undefined> {
  const res = await askJsonLong({
    task:
      "雪かきゲームのホーム画面で、今朝だけ流れる短い曲（ループする BGM）を作曲してください。採点表 song の規則に従います。" +
      `input の事実（雪の量・雪の名前・最低気温・風・時刻・今日の話題）から、曲の性格を決めます（mood はプログラムの見立て。参考にしてよい）。` +
      `bpm は ${BPM_MIN}〜${BPM_MAX}、bars は ${BAR_CHOICES.join("・")} のどれか（16 がおすすめ）。4/4 拍子。` +
      "chords は小節ごとの和音（MIDI 番号 3〜4 音、55〜76 くらい）、bass は小節ごとの根音（28〜52）。" +
      `melody は1本のメロディ（{bar, beat, midi, len}。beat は 0〜3.75 の 0.25 きざみ、midi は ${MELODY_LOW}〜${MELODY_HIGH}、len は拍）。` +
      "動機（2小節くらいの短いフレーズ）を作り、くり返しと変化（A A' B A''）で歌えるメロディにし、最後の小節は頭に自然にもどるように。和音の音を強拍に。" +
      "sparkle は高い鈴の合いの手（72〜100、少なめ。いらなければ空）。groove は lofi（ゆったり）・drive（四つ打ち）・ballad（ビートほぼなし）・march（行進）。lead はメロディの音色（bell・epiano・lead）。" +
      "wind は雪の風の音の強さ 0〜1、crunch は雪を踏む音を入れるか。" +
      `title は日本語 ${TITLE_MAX} 字まで（例: どか雪マーチ・しばれる朝の鈴）、explain はなぜこういう曲にしたか（${EXPLAIN_MAX} 字まで。事実と音の関係を、子どもにもわかることばで）。` +
      "既にある曲のメロディ（童謡・クリスマスソング・アニメなど）は使わず、まったく新しく作ってください。",
    input: { ...f, mood: moodOf(f) },
    schema: SongSchema,
    effort: "high",
    maxTokens: 32000,
  });
  return tidySong(res, f.date, "claude");
}

// ---- 保存（日付ごと。DB があれば day_songs 表、なければメモリ） ----
const TABLE = "create table if not exists day_songs (date text primary key, song jsonb not null, at timestamptz not null default now())";
let ready: Promise<unknown> | undefined;
const g = globalThis as { __shimaenaSongs?: Map<string, SnowSong>; __shimaenaSongPending?: Map<string, Promise<SnowSong>> };
const mem = () => (g.__shimaenaSongs ??= new Map());
const pending = () => (g.__shimaenaSongPending ??= new Map());

export async function loadSnowSong(date: string): Promise<SnowSong | undefined> {
  if (!hasDb()) return mem().get(date);
  try {
    await (ready ??= query(TABLE));
    const rows = await query<{ song: SnowSong }>("select song from day_songs where date = $1", [date]);
    return rows[0]?.song ?? mem().get(date);
  } catch (e) {
    ready = undefined;
    await recordProblem("song/load", e);
    return mem().get(date);
  }
}

async function save(s: SnowSong): Promise<void> {
  mem().set(s.date, s);
  if (!hasDb()) return;
  try {
    await (ready ??= query(TABLE));
    await query("insert into day_songs (date, song, at) values ($1, $2::jsonb, now()) on conflict (date) do update set song = excluded.song, at = now()", [s.date, JSON.stringify(s)]);
  } catch (e) {
    ready = undefined;
    await recordProblem("song/save", e);
  }
}

/** その日の曲を作って残す（同じ日に何度呼んでも作るのは1回。force で作り直す） */
export async function warmSnowSong(date: string, opts: { force?: boolean; now?: Date } = {}): Promise<SnowSong> {
  if (!opts.force) {
    const have = await loadSnowSong(date);
    if (have) return have;
  }
  const p = pending().get(date);
  if (p) return p;
  const job = (async () => {
    const facts = await songFacts(date, opts.now);
    let song: SnowSong | undefined;
    if (hasClaudeKey()) {
      try {
        song = await composeByClaude(facts);
        if (!song) await recordProblem("song/compose", new Error("Claude の曲が点検を通りませんでした（プログラムの曲にします）"));
      } catch (e) {
        await recordProblem("song/compose", e);
      }
    }
    song ??= composeFallback(facts);
    await save(song);
    return song;
  })().finally(() => pending().delete(date));
  pending().set(date, job);
  return job;
}

/** /api/song?date= で作ってよい日（公開中のお金の守り）: 今日と過去 7 日だけ。それ以外の日付で Claude に新しく作曲させない */
export const SONG_DAYS_BACK = 7;
export function songDateAllowed(date: string, today: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= addDays(today, -SONG_DAYS_BACK) && date <= today;
}

/** ホームなどで使う「今日」（今朝の状態の日付に合わせる。lib/morning/today.ts と同じ） */
export async function songDate(now = appNow()): Promise<string> {
  return appToday(await loadMorning(), now);
}
