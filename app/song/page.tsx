import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import SongPlay from "@/components/SongPlay";
import { hasClaudeKey } from "@/lib/claude/client";
import { loadMorning } from "@/lib/morning/store";
import { appToday } from "@/lib/morning/today";
import { runLater } from "@/lib/ops/later";
import { loadSnowSong, songFacts, warmSnowSong } from "@/lib/song/day";
import { songSeconds, type SnowSong } from "@/lib/sound/snow-song";

export const metadata: Metadata = { title: "今朝の雪の歌 ・ シマエナGO" };

const GROOVE = { lofi: "ゆったり", drive: "四つ打ち", ballad: "しずか", march: "行進" } as const;
const LEAD = { bell: "鈴", epiano: "エレピ", lead: "ピコピコ" } as const;

/** 雪の楽譜: 横が時間（小節）、縦が音の高さ。メロディは雪の結晶、鈴は小さな光、和音は下の淡い帯（雪の積もり） */
function SnowScore({ song }: { song: SnowSong }) {
  const W = 640;
  const H = 360;
  const GROUND = 70; // 下の和音の帯の高さ
  const beats = song.bars * 4;
  const xs = (bar: number, beat: number) => 8 + ((bar * 4 + beat) / beats) * (W - 16);
  const pitches = song.melody.map((n) => n[2]); // 高さはメロディで決める（鈴は上の端に寄せる）
  const lo = Math.min(...pitches) - 1;
  const hi = Math.max(...pitches) + 1;
  const ys = (m: number) => 16 + ((hi - m) / Math.max(1, hi - lo)) * (H - GROUND - 36);
  const chordLo = Math.min(...song.chords.flat());
  const chordHi = Math.max(...song.chords.flat());
  const yc = (m: number) => H - 10 - ((m - chordLo) / Math.max(1, chordHi - chordLo)) * (GROUND - 22);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full rounded-2xl" role="img" aria-label={`『${song.title}』の楽譜（${song.bars}小節・メロディ ${song.melody.length} 音）`}>
      <defs>
        <linearGradient id="songSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d2f60" />
          <stop offset="1" stopColor="#5b6fb0" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} rx="16" fill="url(#songSky)" />
      {Array.from({ length: song.bars + 1 }, (_, b) => (
        <line key={b} x1={xs(b, 0)} x2={xs(b, 0)} y1="8" y2={H - 8} stroke="#ffffff" strokeOpacity={b % 4 === 0 ? 0.35 : 0.12} />
      ))}
      <path d={`M0 ${H - GROUND} Q ${W / 4} ${H - GROUND - 12} ${W / 2} ${H - GROUND} T ${W} ${H - GROUND} V ${H} H 0 Z`} fill="#ffffff" opacity="0.14" />
      {song.chords.map((c, b) =>
        c.map((m) => <rect key={`${b}-${m}`} x={xs(b, 0) + 2} y={yc(m) - 3} width={(W - 16) / song.bars - 4} height="6" rx="3" fill="#dfe9ff" opacity="0.5" />),
      )}
      {song.melody.map(([bar, beat, m, len], i) => {
        const x = xs(bar, beat);
        const y = ys(m);
        const w = Math.max(4, xs(bar, beat + len) - x);
        return (
          <g key={`m${i}`}>
            <rect x={x} y={y - 1.5} width={w} height="3" rx="1.5" fill="#ffffff" opacity="0.45" />
            <g transform={`translate(${x} ${y})`} stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round">
              {[0, 60, 120].map((a) => (
                <line key={a} x1="-6.5" y1="0" x2="6.5" y2="0" transform={`rotate(${a})`} />
              ))}
            </g>
          </g>
        );
      })}
      {song.sparkle.map(([bar, beat, m], i) => (
        <circle key={`s${i}`} cx={xs(bar, beat)} cy={Math.max(10, ys(m))} r="3.2" fill="#ffd36e" />
      ))}
    </svg>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  await connection();
  const { as } = await searchParams;
  const q = as && /^[hr]\d+$/.test(as) ? `?as=${as}` : "";
  const date = appToday(await loadMorning());
  const song =
    (await loadSnowSong(date)) ?? (hasClaudeKey() ? (runLater("song/warm", async () => void (await warmSnowSong(date))), undefined) : await warmSnowSong(date));
  const f = await songFacts(date);
  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col gap-3 overflow-hidden bg-paper px-4 py-4 text-ink">
      <div className="flex items-center justify-between">
        <Link href={`/${q}`} className="min-h-11 py-2 text-base font-bold text-ink-soft">
          ‹ ホーム
        </Link>
        <span className="text-sm text-ink-soft">{date.replace(/-/g, ".")}</span>
      </div>
      <header>
        <p className="text-sm font-bold text-ink-soft">今朝の雪の歌</p>
        <h1 className="text-3xl font-black leading-tight">{song ? `『${song.title}』` : "いま作曲しています…"}</h1>
      </header>
      {song ? (
        <>
          <p className="text-lg leading-snug">{song.explain}</p>
          <p className="text-sm text-ink-soft">雪の結晶がメロディ、黄色い光が鈴、下の帯が和音。左から右へ流れて、また頭にもどります。</p>
          <SnowScore song={song} />
          <p className="text-sm text-ink-soft">
            {song.by === "claude" ? "Claude が作曲" : "プログラムが作曲"} ・ {song.bpm} BPM ・ {song.bars} 小節（{songSeconds(song).toFixed(0)} 秒でひとまわり）・ {GROOVE[song.groove]} ・ メロディは{LEAD[song.lead]}
          </p>
          <ul className="flex flex-wrap gap-1.5 text-sm font-bold">
            <li className="rounded-full bg-ice-soft px-3 py-1">
              雪 {f.snowCm}cm{f.snowName ? `「${f.snowName}」` : ""}
            </li>
            {f.tempMinC !== undefined && <li className="rounded-full bg-ice-soft px-3 py-1">最低 {f.tempMinC}℃</li>}
            {f.windMaxMs !== undefined && <li className="rounded-full bg-ice-soft px-3 py-1">風 {f.windMaxMs}m/s</li>}
            {f.topics.slice(0, 2).map((t) => (
              <li key={t} className="rounded-full bg-ice-soft px-3 py-1">
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-auto">
            <SongPlay song={song} />
          </div>
        </>
      ) : (
        <p className="text-lg">Claude が今朝の雪から作曲しています。1分ほどで、もう一度開いてください。</p>
      )}
    </main>
  );
}

export default function SongPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-paper p-6 text-ink">読み込み中…</main>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}
