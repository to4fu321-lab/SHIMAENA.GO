// 町の週刊絵本の文（spec v1.27・採点表 book）: 表紙＋6ページ。ページの役目は決まった順番（下の ROLES）。
// キーあり: Claude が事実だけから、絵本の文・各ページの絵の指示・全ページ共通の「絵の決めごと（style bible）」を書く。
// キーなし／点検に落ちた: 事実から組む決まった文（templateStory）。
import { z } from "zod";
import { askJson, hasClaudeKey } from "../claude/client";
import { allowedNumbers, type BookFacts } from "./facts";

export type PageKind = "cover" | "start" | "snow" | "teams" | "numbers" | "thanks" | "next";

/** 6ページの役目（この順番） */
export const ROLES: { kind: Exclude<PageKind, "cover">; role: string }[] = [
  { kind: "start", role: "週のはじまり。町に雪がやってくる" },
  { kind: "snow", role: "いちばん雪の多かった朝。シマエナガたちが耳あてをして集まる" },
  { kind: "teams", role: "3つの色のチームが、ひとつの道に並ぶ" },
  { kind: "numbers", role: "開いた道の数と、どけた雪の重さ（身近なものにたとえる）" },
  { kind: "thanks", role: "玄関からのありがとうと、家族の応援" },
  { kind: "next", role: "来週へ。チームの色が入れかわり、また雪の朝に会う" },
];

export interface StyleBible {
  /** 全ページで使う色（#rrggbb を5つ） */
  palette: string[];
  /** 主役のシマエナガたちの決まった姿 */
  hero: string;
  /** 町の決まった姿（家並み・電線・山など） */
  world: string;
  /** 絵のタッチ */
  touch: string;
}

export interface BookPage {
  kind: PageKind;
  text: string;
  /** 絵の指示（何を描くか） */
  scene: string;
  /** 描き上がった絵（点検済みの SVG の中身。600×450） */
  svg?: string;
  drawnBy?: "claude" | "program";
}

export interface BookStory {
  title: string;
  subtitle: string;
  style: StyleBible;
  cover: BookPage;
  pages: BookPage[];
  by: "claude" | "template";
}

export const TEXT_MAX = 90;
export const TITLE_MAX = 20;
const COLOR = /^#[0-9a-fA-F]{6}$/;

/** 文に出してはいけないこと（体調・医療・けが・人の名前の呼び方） */
const NG = /病|体調|けが|怪我|転倒|救急|入院|薬|診|死|亡|事故|[一-龠ァ-ヶ]さん|[一-龠ァ-ヶ]様|拠点|番地|丁目/;

const StorySchema = z.object({
  title: z.string(),
  subtitle: z.string(),
  style: z.object({ palette: z.array(z.string()), hero: z.string(), world: z.string(), touch: z.string() }),
  coverScene: z.string(),
  pages: z.array(z.object({ text: z.string(), scene: z.string() })),
});

const DEFAULT_STYLE: StyleBible = {
  palette: ["#fdf6ec", "#9fc3f0", "#3b2a78", "#ffb3c7", "#ffd36e"],
  hero: "白くてまんまるのシマエナガ。黒い小さな目とくちばし、長い尾。チームの色の耳あてと、小さな木のスコップ",
  world: "雪をかぶった三角屋根の家が並ぶ札幌の住宅街。電線、白樺、遠くに低い山",
  touch: "やわらかい水彩風の絵本。丸みのある形、淡いグラデーション、やさしい影",
};

/** キーなし・点検に落ちたときの文（事実から組む） */
export function templateStory(f: BookFacts, town: string): BookStory {
  const t = f.totals;
  const big = f.biggest;
  const [a, b, c] = f.teams;
  const texts: string[] =
    t.mornings > 0
      ? [
          `${f.span}の一週間。${town}には、${t.mornings}回、雪の朝がやってきました。`,
          big
            ? `いちばん雪が多かったのは${big.weekday}曜日の朝。${big.snowName ? `「${big.snowName}」がふって、` : ""}シマエナガたちは耳あてをして集まりました。`
            : "シマエナガたちは耳あてをして、スコップを持って集まりました。",
          `${a.name}の${a.colorName}、${b.name}の${b.colorName}、${c.name}の${c.colorName}。色のちがう耳あてが、ひとつの道に並びました。`,
          t.houses > 0
            ? t.snowKg > 0
              ? `この一週間で開いた道は${t.houses}軒。どけた雪はおよそ${t.snowKg}kg${t.comparison ? `、${t.comparison}` : ""}です。`
              : `この一週間で開いた道は${t.houses}軒。玄関から道路まで、白い雪の中に道が通りました。`
            : "道はまだこれから。みんなで玄関から道路まで、少しずつ開いていきます。",
          t.thanks > 0 || t.cheers > 0
            ? `玄関から「ありがとう」が${t.thanks}回。家族からの応援も${t.cheers}こ届きました。`
            : "玄関の窓から、小さく手をふる人がいました。それがいちばんのごほうびです。",
          "来週はチームの色が入れかわります。また雪がふったら、どこかの玄関で会いましょう。",
        ]
      : [
          `${f.span}の一週間。${town}は、静かな冬の日がつづきました。`,
          "空を見あげて、シマエナガたちは雪を待っています。耳あてはもう、ぴかぴかです。",
          "サルビアの青、マリーゴールドの橙、ルピナスの紫。色のちがう耳あてが、ならんで出番を待っています。",
          "自分の家の前を少しだけ。それも立派な雪かきです。",
          "となりの窓に灯りがつくと、なんだかほっとします。",
          "雪がふったら、どこかの玄関で会いましょう。",
        ];
  return {
    title: `${town}の雪の一週間`,
    subtitle: f.span,
    style: DEFAULT_STYLE,
    cover: { kind: "cover", text: "", scene: "雪の町を見おろす丘で、シマエナガたちがスコップを持って並ぶ" },
    pages: ROLES.map((r, i) => ({ kind: r.kind, text: texts[i], scene: r.role })),
    by: "template",
  };
}

/** Claude の文を点検する（長さ・数・名前・体調の話）。だめな理由を返す（よければ undefined） */
export function storyProblem(s: { title: string; pages: { text: string }[] }, f: BookFacts, names: string[]): string | undefined {
  if (!s.title.trim() || s.title.length > TITLE_MAX) return "題名の長さ";
  if (s.pages.length !== ROLES.length) return "ページの数";
  const ok = allowedNumbers(f);
  for (const [i, p] of s.pages.entries()) {
    const t = p.text.trim();
    if (!t || t.length > TEXT_MAX) return `${i + 1}ページの長さ`;
    if (NG.test(t) || NG.test(s.title)) return `${i + 1}ページに書かないことば`;
    if (names.some((n) => n.length >= 2 && t.includes(n.replace(/さん$/, "")))) return `${i + 1}ページに人の名前`;
    for (const n of t.match(/\d+/g) ?? []) if (!ok.has(Number(n))) return `${i + 1}ページの数（${n}）`;
  }
  return undefined;
}

/** 絵本の文を書く（Claude。だめなら決まった文） */
export async function writeStory(f: BookFacts, town: string, names: string[]): Promise<BookStory> {
  const fallback = templateStory(f, town);
  if (!hasClaudeKey()) return fallback;
  try {
    const res = await askJson({
      task:
        "町内の雪かきの1週間を、子どもとお年寄りが一緒に読める「週刊絵本」にしてください。採点表 book の規則に従います。" +
        `表紙と6ページ。pages は6つで、役目はこの順番です: ${ROLES.map((r, i) => `${i + 1}.${r.role}`).join(" / ")}。` +
        `text は1ページ2〜3文・${TEXT_MAX}字まで。やさしいひらがな多めの日本語で、声に出して読んで気持ちのいいリズムに。数字は facts にあるものだけ。` +
        "登場するのはシマエナガ（白くて丸い小鳥）とチームの色だけ。人の名前・家の場所・体のことは書きません。" +
        `title は${TITLE_MAX}字まで、毎週ちがう、その週の出来事が浮かぶ題名。subtitle は日付の範囲。` +
        "style は全ページで絵をそろえるための決めごと: palette に #rrggbb を5つ、hero に主役のシマエナガたちの決まった姿、world に町の決まった姿、touch に絵のタッチ（その週の雪や話題に合うものを、毎週変える）。" +
        "scene と coverScene は、そのページの絵に何を描くか（60字まで。文字は描かない）。話題（topics）があれば、どこかのページの絵にさりげなく入れます。",
      input: { town, facts: f },
      schema: StorySchema,
      effort: "medium",
    });
    const problem = storyProblem(res, f, names);
    if (problem) throw new Error(`絵本の文が点検に落ちました: ${problem}`);
    const palette = res.style.palette.filter((c) => COLOR.test(c)).slice(0, 5);
    return {
      title: res.title.trim(),
      subtitle: res.subtitle.trim().slice(0, 30) || f.span,
      style: {
        palette: palette.length >= 3 ? palette : DEFAULT_STYLE.palette,
        hero: res.style.hero.slice(0, 160) || DEFAULT_STYLE.hero,
        world: res.style.world.slice(0, 160) || DEFAULT_STYLE.world,
        touch: res.style.touch.slice(0, 160) || DEFAULT_STYLE.touch,
      },
      cover: { kind: "cover", text: "", scene: res.coverScene.slice(0, 80) },
      pages: res.pages.map((p, i) => ({ kind: ROLES[i].kind, text: p.text.trim(), scene: p.scene.slice(0, 80) })),
      by: "claude",
    };
  } catch (e) {
    console.error("[book] 文を Claude で書けませんでした（決まった文にします）:", e instanceof Error ? e.message : e);
    return fallback;
  }
}
