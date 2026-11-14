"use server";

// 今朝の雪の歌ができたかを見るだけ（作曲は始めない）。作曲中の画面が数秒ごとに聞く（spec v1.59）
import { loadSnowSong, songDate } from "@/lib/song/day";

export async function songReadyAction(): Promise<boolean> {
  return Boolean(await loadSnowSong(await songDate()).catch(() => undefined));
}
