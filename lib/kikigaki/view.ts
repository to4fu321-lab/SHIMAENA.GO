// 画面に渡す形（spec v1.26）: 絵は data URI にして <img> にそのまま入れる。
import { wrapPicture } from "../claude/art";

export interface StoryView {
  title: string;
  story: string;
  /** 絵（そのまま <img> に入れられる data URI） */
  image: string;
  by: "claude" | "program";
  share: boolean;
}

export function toView(s: { title: string; story: string; svg: string; by: "claude" | "program"; share: boolean }): StoryView {
  return {
    title: s.title,
    story: s.story,
    image: `data:image/svg+xml;base64,${Buffer.from(wrapPicture(s.svg)).toString("base64")}`,
    by: s.by,
    share: s.share,
  };
}
