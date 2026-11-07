"use client";
// 楽譜の画面の「♪ 聴く」（spec v1.28）: 押すと音を解放して、今朝の雪の歌を鳴らす（スマホは押すまで鳴らせない）。BGM がオフならオンにする。
import { useEffect, useState } from "react";
import { requestBgm, setSnowSong } from "@/lib/sound/bgm";
import { isUnlocked, onUnlocked, setSoundPrefs, unlock, useSoundPrefs } from "@/lib/sound/engine";
import type { SnowSong } from "@/lib/sound/snow-song";
import { useClientValue } from "./useClientValue";

export default function SongPlay({ song }: { song: SnowSong }) {
  const prefs = useSoundPrefs();
  // 鳴っているのは「音が解放されている」かつ「BGM がオン」のとき（スマホは最初のタップまで鳴らない）
  const unlockedAtOpen = useClientValue(false, isUnlocked);
  const [unlockedNow, setUnlockedNow] = useState(false);
  useEffect(() => onUnlocked(() => setUnlockedNow(true)), []);
  const playing = (unlockedAtOpen || unlockedNow) && prefs.bgm && !prefs.ownMusic;
  useEffect(() => {
    setSnowSong(song);
    return requestBgm("snow");
  }, [song]);
  return (
    <button
      type="button"
      onClick={() => {
        void unlock();
        setSoundPrefs({ bgm: !playing, ownMusic: false });
      }}
      className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-lamp px-4 text-xl font-bold text-ink shadow-md"
    >
      {playing ? "■ 止める" : "♪ 聴く"}
    </button>
  );
}
