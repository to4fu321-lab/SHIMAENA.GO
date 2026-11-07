// マイページのプロフィール（spec v1.32・採点表 profile）: 隊長のインタビュー（決まった5問）の答えを、Claude（Haiku）が整える。
// 書くのは「ひとこと・好きなこと・興味・話しかけてほしいこと・アイコンのおすすめ」だけ。答えにないことは足さない。
// キーがない・失敗・点検に通らないときは組み立て（lib/mypage/rules.ts の templateProfile）。名前・住所・体のことは点検で落とす。
import { z } from "zod";
import {
  cleanIntro,
  cleanTags,
  ICONS,
  INTRO_MAX,
  isIconId,
  suggestIcon,
  TALK_MAX,
  templateProfile,
  type IconId,
  type ProfileTurn,
} from "../mypage/rules";
import { askJson, hasClaudeKey } from "./client";

const Schema = z.object({
  /** ひとこと（40字まで。本人の口調で、ですます） */
  intro: z.string(),
  /** 好きなこと（10字までの短い札、5つまで） */
  likes: z.array(z.string()),
  /** 興味あること（10字までの短い札、5つまで） */
  interests: z.array(z.string()),
  /** 話しかけてほしいこと（30字まで） */
  talk: z.string(),
  /** アイコンの id（一覧から） */
  icon: z.string(),
});

export interface TidyProfile {
  intro: string;
  likes: string[];
  interests: string[];
  talk: string;
  icon: IconId;
  by: "claude" | "program";
}

/** 答えをプロフィールに整える */
export async function tidyProfile(turns: ProfileTurn[]): Promise<TidyProfile> {
  const tpl = { ...templateProfile(turns), by: "program" as const };
  const answered = turns.filter((t) => t.a.trim());
  if (!hasClaudeKey() || answered.length === 0) return tpl;
  try {
    const res = await askJson({
      task:
        "シマエナ隊長のインタビュー（5問）の答えから、雪かき仲間に見せる短いプロフィールを整えてください。採点表 profile の規則に従います。" +
        "intro は本人が言っているような「ひとこと」（40字まで、ですます。答えのことばを活かし、作り話を足さない）。" +
        "likes は好きなこと、interests は興味あること・やってみたいこと。それぞれ10字までの短い名詞の札で5つまで（「〜が好き」は付けない。答えになければ空）。" +
        "talk は「雪かきのあと、こんな話ができたら」のひとこと（30字まで、答えになければ空）。" +
        "icon は一覧（id と意味）から、答えにいちばん合うものを1つ。" +
        "名前・住所・電話・会社名・体調や病気のことは入れない。恋愛・気持ちの推測・評価の言葉（すばらしい など）は書かない。",
      input: {
        turns: answered.map((t) => ({ q: t.q, a: t.a })),
        icons: ICONS.map((i) => ({ id: i.id, meaning: i.label })),
      },
      schema: Schema,
      effort: "low",
      model: "light",
    });
    const intro = cleanIntro(res.intro, INTRO_MAX) || tpl.intro;
    const likes = cleanTags(res.likes);
    const interests = cleanTags(res.interests);
    const talk = cleanIntro(res.talk, TALK_MAX);
    const icon = isIconId(res.icon) ? res.icon : suggestIcon([...likes, ...interests, intro]);
    return { intro, likes: likes.length ? likes : tpl.likes, interests: interests.length ? interests : tpl.interests, talk: talk || tpl.talk, icon, by: "claude" };
  } catch (e) {
    console.error("[mypage] プロフィールを整えられませんでした（組み立てにします）:", e instanceof Error ? e.message : e);
    return tpl;
  }
}
