// 町の週刊絵本を作る（spec v1.27）: 1週間の記録 → 事実 → 文（Claude）→ さし絵（はじめはプログラムの絵、Claude が描けたページから差しかえ）。
// 日曜の「今週の群れ」と、/admin の「今週の絵本を作る」から。
import { drawIllustration } from "../claude/illustrate";
import { hasClaudeKey } from "../claude/client";
import { weekStart as weekStartOf } from "../game/week";
import { addDays } from "../jst";
import { loadRoster } from "../morning/roster";
import { listMornings, loadMorning } from "../morning/store";
import { appToday } from "../morning/today";
import { runLater } from "../ops/later";
import { recordProblem } from "../ops/problems";
import { dayTopic } from "../topic/day";
import { TOWN } from "../town";
import { PAGE_H, PAGE_W, programPage } from "./draw";
import { bookFacts } from "./facts";
import { loadBook, saveBook, updateBook, type Book } from "./store";
import { writeStory, type BookPage } from "./story";
import { appNow } from "@/lib/clock";

export const TOWN_SHORT = TOWN.name.replace(/（.*）$/, "");

/** いまの「今週」（アプリの今日から。デモの朝ならその週） */
export async function currentWeekStart(now = appNow()): Promise<string> {
  return weekStartOf(appToday(await loadMorning(), now));
}

/** その週の絵本を作る（同じ週があれば作り直す）。文とプログラムの絵ですぐ読める形で保存し、Claude のさし絵は返事のあとで */
export async function makeBook(weekStart: string, now = appNow()): Promise<Book> {
  const records = await listMornings(weekStart, addDays(weekStart, 6));
  const topics: Record<string, string> = {};
  for (const r of records) {
    const d = r.morning.rollcall.date;
    const t = await dayTopic(d, 3000).catch(() => undefined);
    if (t?.items[0]) topics[d] = t.items[0].label;
  }
  const facts = bookFacts(records, weekStart, topics);
  const roster = await loadRoster();
  const story = await writeStory(facts, TOWN_SHORT, roster.participants.map((p) => p.nickname));
  const seed = `${weekStart}|${now.getTime()}`;
  const draw = (p: BookPage): BookPage => ({ ...p, svg: programPage(p.kind, facts, story.style, seed), drawnBy: "program" });
  const willDraw = hasClaudeKey();
  const book: Book = {
    ...story,
    cover: draw(story.cover),
    pages: story.pages.map(draw),
    weekStart,
    span: facts.span,
    status: willDraw ? "drawing" : "done",
    total: story.pages.length + 1,
    drawn: 0,
    at: now.toISOString(),
    facts,
  };
  await saveBook(book);
  if (willDraw) drawBookLater(book);
  return book;
}

/** さし絵7枚を並べて描き、描けたページから差しかえる（描けなかったページはプログラムの絵のまま） */
function drawBookLater(book: Book): void {
  runLater("book/draw", async () => {
    const all: BookPage[] = [book.cover, ...book.pages];
    const at = book.at;
    await Promise.allSettled(
      all.map(async (page, i) => {
        try {
          const res = await drawIllustration({
            width: PAGE_W,
            height: PAGE_H,
            style: book.style,
            scene: page.scene,
            ...(page.text ? { text: page.text } : {}),
            facts: { teams: book.facts.teams.map((t) => ({ name: t.name, color: t.color })), totals: book.facts.totals, topics: book.facts.topics, title: i === 0 ? book.title : undefined },
            idPrefix: `bk${i}${book.weekStart.replace(/-/g, "")}`,
          });
          if (!res) return;
          await updateBook(book.weekStart, (b) => {
            if (b.at !== at) return; // 作り直されていたら書かない
            const target = i === 0 ? b.cover : b.pages[i - 1];
            target.svg = res.svg;
            target.drawnBy = "claude";
            b.drawn++;
          });
        } catch (e) {
          await recordProblem("book/draw", e);
        }
      }),
    );
    await updateBook(book.weekStart, (b) => {
      if (b.at === at) b.status = "done";
    });
  });
}

/** 今週の絵本（なければ undefined） */
export async function thisWeekBook(now = appNow()): Promise<Book | undefined> {
  return loadBook(await currentWeekStart(now));
}
