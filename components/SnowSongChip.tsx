"use client";
// 今朝の雪の歌（spec v1.28）: ホームの空の左上に小さな札。置くと、その日の曲を BGM として頼む（なければ「しらかばの朝」）。
// 札を押すと、なぜこういう曲なのか（Claude の解説）と「楽譜を見る」。高さを取らないよう、空の左下（家並みの上）に重ね、上に開く。
import Link from "next/link";
import { useEffect, useState } from "react";
import { requestBgm, setSnowSong } from "@/lib/sound/bgm";
import type { SnowSong } from "@/lib/sound/snow-song";

export default function SnowSongChip({ song, q = "" }: { song: SnowSong; q?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setSnowSong(song);
    return requestBgm("snow");
  }, [song]);
  return (
    <div className="absolute bottom-2 left-2 z-20 flex max-w-[78%] flex-col-reverse items-start">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-10 max-w-full items-center gap-1.5 rounded-full bg-card/90 px-3 py-1 text-sm font-bold text-ink shadow-md ring-1 ring-ink/10 backdrop-blur"
      >
        <span aria-hidden="true" className="motion-safe:animate-bounce">
          ♪
        </span>
        <span className="truncate">今朝の雪の歌『{song.title}』</span>
      </button>
      {open && (
        <div className="mb-1.5 rounded-2xl bg-card p-3 text-base leading-snug text-ink shadow-lg ring-1 ring-ink/10">
          <p>{song.explain || "今朝の雪から作った、きょうだけの曲です。"}</p>
          <p className="mt-1 text-sm text-ink-soft">
            {song.by === "claude" ? "Claude が今朝の雪から作曲" : "今朝の雪からプログラムが作曲"} ・ {song.bpm} BPM ・ {song.bars} 小節
          </p>
          <div className="mt-2 flex gap-2">
            <Link href={`/song${q}`} className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-lamp px-3 font-bold text-ink">
              楽譜を見る
            </Link>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-xl px-3 font-bold text-ink-soft ring-1 ring-ink/15">
              閉じる
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
