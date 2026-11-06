// 週刊絵本の保存先（spec v1.27）。DATABASE_URL があれば books 表（はじめて使うときに作る）、なければメモリ。
import { hasDb, query } from "../db";
import { recordProblem } from "../ops/problems";
import type { BookFacts } from "./facts";
import type { BookStory } from "./story";

export interface Book extends BookStory {
  weekStart: string;
  span: string;
  /** drawing = Claude がさし絵を描いている途中（できたページから差しかわる） */
  status: "drawing" | "done";
  /** さし絵の数（表紙＋6）と、Claude が描き終えた数 */
  total: number;
  drawn: number;
  at: string;
  facts: BookFacts;
}

const TABLE = "create table if not exists books (week_start text primary key, book jsonb not null, at timestamptz not null default now())";
let ready: Promise<unknown> | undefined;
const ensure = () =>
  (ready ??= query(TABLE).catch((e) => {
    ready = undefined;
    throw e;
  }));
const g = globalThis as { __shimaenaBooks?: Map<string, Book> };
const mem = () => (g.__shimaenaBooks ??= new Map());

export async function loadBook(weekStart: string): Promise<Book | undefined> {
  if (!hasDb()) return mem().get(weekStart);
  try {
    await ensure();
    const rows = await query<{ book: Book }>("select book from books where week_start = $1", [weekStart]);
    return rows[0]?.book;
  } catch (e) {
    await recordProblem("book/load", e);
    return mem().get(weekStart);
  }
}

export async function saveBook(b: Book): Promise<void> {
  mem().set(b.weekStart, b);
  if (!hasDb()) return;
  try {
    await ensure();
    await query(
      "insert into books (week_start, book, at) values ($1, $2::jsonb, now()) on conflict (week_start) do update set book = excluded.book, at = now()",
      [b.weekStart, JSON.stringify(b)],
    );
  } catch (e) {
    await recordProblem("book/save", e);
  }
}

/** 新しい週から順に、週の始まりと題名 */
export async function listBooks(limit = 12): Promise<{ weekStart: string; title: string; span: string }[]> {
  if (!hasDb()) {
    return [...mem().values()].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)).slice(0, limit).map((b) => ({ weekStart: b.weekStart, title: b.title, span: b.span }));
  }
  try {
    await ensure();
    return await query<{ weekStart: string; title: string; span: string }>(
      `select week_start as "weekStart", book->>'title' as title, book->>'span' as span from books order by week_start desc limit $1`,
      [limit],
    );
  } catch (e) {
    await recordProblem("book/list", e);
    return [];
  }
}

// 1冊の書き換えを順番に（さし絵は並んで描き上がるので、読む→直す→書くが重ならないように）
const chains = new Map<string, Promise<unknown>>();
export function updateBook(weekStart: string, change: (b: Book) => void): Promise<void> {
  const prev = chains.get(weekStart) ?? Promise.resolve();
  const next = prev.then(async () => {
    const b = await loadBook(weekStart);
    if (!b) return;
    change(b);
    await saveBook(b);
  });
  chains.set(weekStart, next.catch(() => undefined));
  return next;
}
