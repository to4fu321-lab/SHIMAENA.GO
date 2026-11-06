"use client";
// 画面が出た瞬間に効果音を鳴らす（server component の演出に音を付けるため。spec v1.19）。
// 例: 今週のチームの発表 → ドロロロ…→ ピロリン（CSS の team-reveal に合わせる）
import { useEffect } from "react";
import { play } from "@/lib/sound/engine";
import type { SfxName } from "@/lib/sound/sfx";

export default function PlayOnMount({ sounds }: { sounds: { name: SfxName; delay?: number }[] }) {
  useEffect(() => {
    for (const s of sounds) play(s.name, { delay: s.delay });
    // 置いたときの一覧だけ使う（描き直しで鳴り直さない）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
