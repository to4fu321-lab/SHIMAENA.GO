// 雪の聞き書きの流れ（spec v1.26）: お話にする → 本人が「届ける／自分だけ」を選ぶ → その家の雪かきが終わったら、来てくれた人の隊長トークに届く。
import { COLORS } from "../brand";
import { writeStory } from "../claude/kikigaki";
import { push } from "../line/client";
import type { FlexMessage, LineMessage } from "../line/types";
import { baseUrl } from "../url";
import { drawMemory, programMemory } from "./art";
import { motifsOf, shouldDeliver, type Turn } from "./core";
import { newStoryId, saveStory, storyOf, type Story } from "./store";
import { appNow } from "@/lib/clock";

/** やりとりから、お話と絵を作って保存する（届けるかどうかは、まだ決めていない＝届けない） */
export async function createStory(requesterId: string, turns: Turn[], now = appNow()): Promise<Story> {
  const id = newStoryId();
  const text = await writeStory(turns);
  let svg: string | undefined;
  if (text.by === "claude") {
    try {
      svg = await drawMemory({ title: text.title, story: text.story, scene: text.scene || text.title, seed: id });
    } catch (e) {
      console.error("[kikigaki] 絵を描けませんでした（組み立ての絵にします）:", e instanceof Error ? e.message : e);
    }
  }
  const story: Story = {
    id,
    requesterId,
    title: text.title,
    story: text.story,
    svg: svg ?? programMemory(id, motifsOf(turns)),
    by: text.by === "claude" && svg ? "claude" : "program",
    share: false,
    delivered: [],
    createdAt: now.toISOString(),
  };
  await saveStory(story);
  return story;
}

/** 届ける／自分だけにしておく（あとから何度でも変えられる） */
export async function setShare(requesterId: string, share: boolean): Promise<Story | undefined> {
  const s = await storyOf(requesterId);
  if (!s) return undefined;
  s.share = share;
  await saveStory(s);
  return s;
}

export const storyImagePath = (id: string) => `/api/kikigaki/${id}/image.png`;

/** 来てくれた人への吹き出し: 絵（大きく）＋「この家の雪の思い出が届きました」＋題名＋お話 */
export function storyMessage(s: Pick<Story, "id" | "title" | "story">): FlexMessage {
  return {
    type: "flex",
    altText: `この家の雪の思い出が届きました「${s.title}」`,
    contents: {
      type: "bubble",
      size: "giga",
      hero: { type: "image", url: `${baseUrl()}${storyImagePath(s.id)}`, size: "full", aspectRatio: "27:28", aspectMode: "cover" },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "20px",
        contents: [
          { type: "text", text: "📖 この家の雪の思い出が届きました", size: "md", weight: "bold", color: COLORS.lamp, wrap: true },
          { type: "text", text: `「${s.title}」`, size: "xl", weight: "bold", color: COLORS.ink, wrap: true },
          { type: "text", text: s.story, size: "lg", color: COLORS.ink, wrap: true },
          { type: "text", text: "雪かきを頼んだ方が、隊長に話してくれたお話です。次に会ったら、話のつづきを聞いてみてください。", size: "sm", color: COLORS.winter, wrap: true },
        ],
      },
    },
  };
}

/** その家の雪かきが終わったとき: 届けてよいお話があれば、その題名（カードの裏に1行）と、送る相手ごとの吹き出し */
export async function storyForMission(requesterId: string | undefined, missionId: string): Promise<Story | undefined> {
  if (!requesterId) return undefined;
  const s = await storyOf(requesterId);
  return shouldDeliver(s, missionId) ? s : undefined;
}

/** 来てくれた人たちの隊長トークに届け、同じ家の同じ回に二度届けないよう印をつける。届けた人数 */
export async function deliverStory(s: Story, missionId: string, keys: (string | undefined)[]): Promise<number> {
  let sent = 0;
  const messages: LineMessage[] = [storyMessage(s)];
  for (const k of new Set(keys.filter((x): x is string => Boolean(x)))) if (await push(k, messages)) sent++;
  s.delivered = [...s.delivered, missionId].slice(-50);
  await saveStory(s);
  return sent;
}

/** デモ用: 架空のお話を1件入れる（届ける、を選んだ状態）。キーがなくても見せられるように */
export async function seedDemoStory(requesterId: string, now = appNow()): Promise<Story> {
  const turns: Turn[] = [
    { q: "子どものころの雪の日で、いちばん覚えていることは何ですか？", a: "兄と裏の坂で、みかん箱をそりにして日が暮れるまで滑ったこと。手袋がかちかちに凍ってね。" },
    { q: "そのころの雪かきは、だれと、どんな道具でしていましたか？", a: "父が木のスコップで、朝いちばんに玄関から道まで一本道をつけてくれた。その音で目がさめたの。" },
    { q: "雪の日の、ちょっとした知恵やコツはありますか？", a: "雪は降っているうちに少しずつ。重たくなる前にね。" },
    { q: "雪かきに来てくれる人たちに、ひとこと伝えるなら？", a: "スコップの音がすると、ああ朝が来たなって、うれしくなるのよ。" },
  ];
  const s: Story = {
    id: newStoryId(),
    requesterId,
    title: "坂道とそりの冬",
    story:
      "子どものころ、兄と裏の坂で、みかん箱をそりにして日が暮れるまで滑りました。手袋がかちかちに凍ってね。朝は、父が木のスコップで玄関から道まで一本道をつけてくれて、その音で目がさめたものです。雪は重たくなる前に、降っているうちに少しずつ。だから今も、スコップの音がすると、ああ朝が来たなって、うれしくなるのよ。来てくれて、ありがとう。",
    svg: programMemory(`demo-${requesterId}`, motifsOf(turns)),
    by: "program",
    share: true,
    delivered: [],
    createdAt: now.toISOString(),
  };
  await saveStory(s);
  return s;
}
