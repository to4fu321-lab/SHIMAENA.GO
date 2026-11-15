"use client";

// 1軒完了！（spec v1.60）: 自分の「終わりました」で写真の確認が終わった瞬間の画面。
// ファンファーレ・紙ふぶき・はんこ「1軒 完了！」と、写真の判定（隊長 Claude が見たこと）を出す。シマエナ隊長が声でも言う（spec v1.61）。
// 星はプログラムが数える（雪がどけてある・通れる・凍っていない、の3つ）。AI に点数は付けさせない。
// 点（チームの得点）はここでは出さない。まとめて見せるのは「今日はここまで！」（DayClear。spec v1.57）。
// ほかの人の完了は、今までどおり軽い知らせ（ClearToast）。
import { useEffect, useState } from "react";
import type { ClearSummary } from "@/lib/morning/clear";
import { TEAMS } from "@/lib/teams";
import { play } from "@/lib/sound/engine";
import { clearVoiceText, photoStars, verdictWord } from "@/lib/morning/clear-voice";
import { soundPrefs } from "@/lib/sound/engine";
import { speakCaptain, stopCaptainVoice } from "./ChatTools";
import Mascot from "./Mascot";

const CONFETTI = ["#ffd27a", "#8fb8d9", "#c8a7b8", "#ffffff", "#f0a070"];

export default function HouseClear({ clear, onClose }: { clear: ClearSummary; onClose: () => void }) {
  const team = TEAMS.find((t) => t.id === clear.teamIds[0]);
  const photo = clear.photo;
  // 判定の3行: 1行ずつ「ポン」と出す
  const rows = photo && !photo.uncertain
    ? [
        { ok: photo.cleared, label: photo.cleared ? "雪がどけてあります" : "雪がまだ残っています" },
        { ok: photo.passable, label: photo.passable ? `通れます${clear.widthLabel ? `（${clear.widthLabel}）` : ""}` : "通りにくいところがあります" },
        { ok: !photo.icy, label: photo.icy ? "凍っているところがあります" : "凍結は見えません" },
      ]
    : [];
  const stars = photoStars(photo) ?? 0;
  const [shown, setShown] = useState(0);
  useEffect(() => {
    play("missionClear");
    play("lamp", { delay: 0.9 });
    const timers = rows.map((_, i) =>
      setTimeout(() => {
        setShown(i + 1);
        play("countPop");
      }, 1100 + i * 380),
    );
    const done = setTimeout(() => setShown(99), 1100 + rows.length * 380 + 150);
    // シマエナ隊長の声（spec v1.61）: ファンファーレのあとに「やったー！1軒完了だしま〜！」→ 写真の判定 → ひとこと。
    // 効果音を切っている人には読まない。声が作れないときは端末の声（ChatTools の speakCaptain）
    const voice = setTimeout(() => {
      if (soundPrefs().sfx) speakCaptain(clearVoiceText(clear));
    }, 900);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(done);
      clearTimeout(voice);
      stopCaptainVoice(); // 「つぎへ」で閉じたら、声も止める
    };
    // 開いたときに1回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (shown === 99 && rows.length > 0) play(stars === 3 ? "cardChime" : "confirm");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  const verdict = photo?.pending ? "判定はあとで届きます" : photo ? verdictWord(photoStars(photo)) : undefined;
  const notes = [
    clear.evidence && `見たところ: ${clear.evidence}`,
    clear.snowTypeLabel && `雪質: ${clear.snowTypeLabel}${clear.snowTypeReason ? `（${clear.snowTypeReason}）` : ""}`,
  ].filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-[1400] mx-auto flex max-w-md flex-col overflow-hidden bg-ink/95 px-4 backdrop-blur-sm pb-[max(16px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))] text-white" role="dialog" aria-modal="true" aria-label={`拠点${clear.baseNumber} 1軒完了`}>
      <span className="flash-rays pointer-events-none absolute left-1/2 top-[22%] size-[180vmax]" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-0" aria-hidden="true">
        {Array.from({ length: 18 }, (_, i) => (
          <span key={i} className="confetti" style={{ left: `${(i * 53 + 7) % 100}%`, background: CONFETTI[i % CONFETTI.length], animationDelay: `${(i % 9) * 0.32}s` }} />
        ))}
      </div>

      {/* 上: はんこ */}
      <div className="relative shrink-0 text-center">
        <Mascot size={84} mood="happy" team={team?.id} className="team-reveal mx-auto short:hidden" />
        <p className="flash-stamp mt-1 inline-block rounded-2xl border-4 border-[#ffd27a] px-5 py-0.5 text-5xl font-black text-[#ffd27a] max-[380px]:text-4xl">1軒 完了！</p>
        <p className="flash-sub mt-2 text-xl font-bold">
          <span className="mr-1 inline-block size-3 rounded-full align-middle" style={{ background: team?.color ?? "#ffd27a" }} aria-hidden="true" />
          拠点{clear.baseNumber} に灯りがともりました
        </p>
        <p className="flash-sub text-base text-white/85">
          今朝の家 {clear.done}/{clear.total}軒{clear.allDone ? " ・ すべて完了！" : ` ・ あと${clear.left}軒`}
        </p>
      </div>

      {/* 真ん中: 写真の判定 */}
      {photo && (
        <section className="flash-sub relative mt-3 min-h-0 flex-1 overflow-y-auto rounded-3xl bg-card px-4 py-3 text-ink shadow-xl" aria-label="写真の判定">
          <div className="flex items-center gap-2">
            <p className="eyebrow flex-1 whitespace-nowrap">📷 写真の判定（隊長）</p>
            {rows.length > 0 && (
              <p className={`text-2xl leading-none transition-opacity duration-300 ${shown === 99 ? "opacity-100" : "opacity-0"}`} aria-label={`星 ${stars}つ（3つのうち）`}>
                {[0, 1, 2].map((i) => (
                  <span key={i} className={i < stars ? "text-[#f0a030]" : "text-ink/20"} aria-hidden="true">
                    ★
                  </span>
                ))}
              </p>
            )}
          </div>
          {verdict && <p className={`mt-0.5 text-2xl font-black leading-tight ${rows.length > 0 && shown !== 99 ? "opacity-0" : "tut-pop"}`}>{verdict}</p>}
          {rows.length > 0 && (
            <ul className="mt-2 space-y-1.5">
              {rows.map((r, i) => (
                <li key={r.label} className={`flex items-center gap-2 text-lg font-bold leading-tight ${i < shown ? "tut-pop" : "opacity-0"}`}>
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full text-base text-white ${r.ok ? "bg-ice" : "bg-lamp"}`} aria-hidden="true">
                    {r.ok ? "✓" : "！"}
                  </span>
                  {r.label}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 rounded-2xl bg-warm px-3 py-2 text-base leading-snug">「{photo.comment}」</p>
          {notes.map((n) => (
            <p key={n} className="mt-1.5 text-sm leading-snug text-ink-soft">
              {n}
            </p>
          ))}
          {(clear.hazards ?? []).map((h) => (
            <p key={h} className="mt-1.5 rounded-2xl bg-alert-soft px-3 py-1.5 text-base font-bold leading-snug text-alert">
              ⚠️ {h}
            </p>
          ))}
          {clear.care && <p className="mt-1.5 text-base leading-snug short:hidden">{clear.care}</p>}
          {rows.length > 0 && <p className="mt-1.5 text-xs text-ink-soft short:hidden">写真は Claude が見て、星は上の3つの ✓ をプログラムが数えています。</p>}
        </section>
      )}

      {/* 下: 次へ */}
      <div className="relative mt-3 shrink-0 space-y-2">
        <p className="text-center text-sm leading-snug text-white/85">
          {clear.cardTonight && (
            <>
              🎴 カードは今夜9時ごろ、隊長が届けます
              <br />
            </>
          )}
          点は「今日はここまで！」でまとめて
        </p>
        <button type="button" onClick={onClose} className="btn btn-lamp btn-big w-full text-xl" data-sound="tap">
          つぎへ
        </button>
      </div>
    </div>
  );
}
