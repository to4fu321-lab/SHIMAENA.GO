// 雪の聞き書きの保存（spec v1.26）: 頼む家の人ごとに、いちばん新しいお話を1つ。DB があれば kikigaki_stories 表（なければ作る）、ないあいだはメモリ。
// 話した答えそのものは残さない（お話・題名・絵・届けてよいか・届けた家だけ）。
import { randomBytes } from "node:crypto";
import { hasDb, query } from "../db";
import { recordProblem } from "../ops/problems";

export interface Story {
  /** 画像の URL に使う印（推測されにくい） */
  id: string;
  requesterId: string;
  title: string;
  story: string;
  /** 絵（点検済みの SVG の中身。座標 0〜540 × 0〜560） */
  svg: string;
  /** claude = Claude が書いて描いた、program = キーなしの組み立て */
  by: "claude" | "program";
  /** 本人が「雪かきに来てくれた人に届ける」を選んだか */
  share: boolean;
  /** 届けたミッション ID（同じ家の同じ回に二度届けない） */
  delivered: string[];
  createdAt: string;
}

export const newStoryId = () => `kg-${randomBytes(9).toString("base64url")}`;

const TABLE = `create table if not exists kikigaki_stories (
  id text primary key,
  requester_id text not null,
  story jsonb not null,
  at timestamptz not null default now())`;
const INDEX = "create index if not exists kikigaki_stories_requester on kikigaki_stories (requester_id, at)";
let ready: Promise<unknown> | undefined;
const ensure = () =>
  (ready ??= query(TABLE)
    .then(() => query(INDEX))
    .catch((e) => {
      ready = undefined;
      throw e;
    }));

const g = globalThis as { __shimaenaKikigaki?: Map<string, Story> };
const mem = () => (g.__shimaenaKikigaki ??= new Map());

/** その人のお話（いちばん新しいもの） */
export async function storyOf(requesterId: string): Promise<Story | undefined> {
  if (!hasDb()) return [...mem().values()].find((s) => s.requesterId === requesterId);
  try {
    await ensure();
    const rows = await query<{ story: Story }>("select story from kikigaki_stories where requester_id = $1 order by at desc limit 1", [requesterId]);
    return rows[0]?.story;
  } catch (e) {
    await recordProblem("kikigaki/load", e);
    return undefined;
  }
}

export async function storyById(id: string): Promise<Story | undefined> {
  if (!/^kg-[\w-]{6,20}$/.test(id)) return undefined;
  if (!hasDb()) return mem().get(id);
  try {
    await ensure();
    const rows = await query<{ story: Story }>("select story from kikigaki_stories where id = $1", [id]);
    return rows[0]?.story;
  } catch (e) {
    await recordProblem("kikigaki/load", e);
    return undefined;
  }
}

/** 保存する（その人の前のお話は消して、新しいもの1つにする） */
export async function saveStory(s: Story): Promise<void> {
  if (!hasDb()) {
    for (const [k, v] of mem()) if (v.requesterId === s.requesterId && k !== s.id) mem().delete(k);
    mem().set(s.id, structuredClone(s));
    return;
  }
  await ensure();
  await query("delete from kikigaki_stories where requester_id = $1 and id <> $2", [s.requesterId, s.id]);
  await query(
    `insert into kikigaki_stories (id, requester_id, story, at) values ($1, $2, $3::jsonb, $4)
     on conflict (id) do update set story = excluded.story`,
    [s.id, s.requesterId, JSON.stringify(s), s.createdAt],
  );
}
