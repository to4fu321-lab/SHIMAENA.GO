"use client";
// この画面の BGM（spec v1.19）。置くだけで、画面が出ている間その曲を頼む。
// 同じ曲の画面どうしを移っても頭に戻らない。level は音量の倍率（隊長トークは 0.5）。
import { useEffect } from "react";
import { requestBgm, type BgmTrack } from "@/lib/sound/bgm";

export default function Bgm({ track, level = 1 }: { track: BgmTrack; level?: number }) {
  useEffect(() => requestBgm(track, level), [track, level]);
  return null;
}
