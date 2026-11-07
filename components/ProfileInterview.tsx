"use client";

// マイページのインタビュー（spec v1.31）: 隊長が決まった5問を1つずつ聞く（読み上げ・声で答える・とばせる）→ Claude が整える。
// 答えは画面が持ち、整えるときに1回だけ送る。できた下書きは親（MyPageScreen）が見せて、本人が直してから保存する。
import { useEffect, useState } from "react";
import { tidyProfileAction } from "@/app/me/actions";
import type { TidyProfile } from "@/lib/claude/profile";
import { PROFILE_MAX_TURNS, PROFILE_OPENING, PROFILE_QUESTIONS, type ProfileTurn } from "@/lib/mypage/rules";
import { play } from "@/lib/sound/engine";
import { canSpeak, speak } from "./ChatTools";
import Mascot from "./Mascot";
import MicButton from "./MicButton";
import { useClientValue } from "./useClientValue";

const TIDYING = ["答えを読んでいます…", "好きなことを札にしています…", "ひとことを整えています…", "アイコンを選んでいます…"];

export default function ProfileInterview({ viewerId, nickname, onDone, onCancel }: { viewerId: string; nickname: string; onDone: (d: TidyProfile) => void; onCancel: () => void }) {
  const [i, setI] = useState(0);
  const [turns, setTurns] = useState<ProfileTurn[]>([]);
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [tidying, setTidying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [note, setNote] = useState<string>();
  const [voiceOn, setVoiceOn] = useState(true);
  const speakable = useClientValue(false, canSpeak);
  const q = PROFILE_QUESTIONS[i];

  const say = (text: string) => {
    if (voiceOn && speakable) speak(text);
  };

  // 最初の質問を読み上げる（開いたとき）
  useEffect(() => {
    play("chirp");
    say(`${PROFILE_OPENING}${PROFILE_QUESTIONS[0].q}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!tidying) return;
    const t = window.setInterval(() => setIdx((x) => Math.min(TIDYING.length - 1, x + 1)), 1800);
    return () => window.clearInterval(t);
  }, [tidying]);

  const finish = async (all: ProfileTurn[]) => {
    if (all.every((t) => !t.a.trim())) {
      setNote("ひとつだけでも答えてもらえると、形にできます。");
      return;
    }
    if (typeof window !== "undefined" && canSpeak()) window.speechSynthesis.cancel();
    setTidying(true);
    setIdx(0);
    setBusy(true);
    try {
      // 整える時間も「間」のうち: 早く終わっても 2.5 秒は待つ
      const [r] = await Promise.all([tidyProfileAction(viewerId, all), new Promise((res) => setTimeout(res, 2500))]);
      if (!r.ok || !r.draft) {
        setNote(r.text ?? "うまくいきませんでした。もう一度お試しください。");
        setTidying(false);
        return;
      }
      play("cardChime");
      onDone(r.draft);
    } catch {
      setNote("通信がうまくいきませんでした。もう一度お試しください。");
      setTidying(false);
    } finally {
      setBusy(false);
    }
  };

  const next = async (skip = false) => {
    if (busy) return;
    const a = skip ? "" : answer.trim();
    const all = [...turns, { q: q.q, a }];
    setTurns(all);
    setAnswer("");
    setNote(undefined);
    play(skip ? "back" : "send");
    if (i + 1 >= PROFILE_MAX_TURNS) {
      await finish(all);
      return;
    }
    setI(i + 1);
    play("chirp");
    say(`${a ? "ありがとうございます。" : ""}${PROFILE_QUESTIONS[i + 1].q}`);
  };

  if (tidying) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 rounded-3xl bg-card p-5 text-center shadow-sm ring-1 ring-ink/10">
        <Mascot size={96} mood="happy" className="animate-bounce" />
        <p className="text-xl font-bold">{TIDYING[idx]}</p>
        <p className="text-base text-ink-soft">答えたことばだけで作ります。作り話は足しません。</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel} className="btn btn-white min-h-10 px-3 text-sm">
            ‹ やめる
          </button>
          <ol className="flex gap-1.5" aria-label={`${i + 1} 問目 / ${PROFILE_MAX_TURNS}`}>
            {PROFILE_QUESTIONS.map((x, k) => (
              <li key={x.key} className={`grid size-7 place-items-center rounded-full text-sm ${k < i ? "bg-ice text-white" : k === i ? "bg-lamp text-white" : "bg-ice-soft text-ink-soft"}`}>
                ❄
              </li>
            ))}
          </ol>
        </div>
        {speakable && (
          <button type="button" className="btn btn-white min-h-10 px-3 text-sm" aria-pressed={voiceOn} onClick={() => setVoiceOn((v) => !v)}>
            {voiceOn ? "🔊" : "🔈"}
          </button>
        )}
      </div>
      <div key={q.key} className="flex shrink-0 gap-2">
        <Mascot size={56} className="shrink-0" />
        <div className="min-w-0 flex-1 rounded-3xl rounded-tl-md bg-card p-3.5 shadow-sm ring-1 ring-ink/10">
          {i === 0 && <p className="mb-1 text-sm leading-snug text-ink-soft">{nickname}さん、仲間に見せる紹介を一緒に作りましょう。</p>}
          <p className="text-[21px] font-bold leading-snug short:text-lg">{q.q}</p>
          <p className="mt-1 text-sm text-ink-soft">{q.hint}</p>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-start gap-2">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="声でも、文字でも。ひとことで大丈夫です"
          aria-label="答え"
          className="min-h-0 flex-1 self-stretch resize-none rounded-2xl bg-card p-3 text-lg leading-snug shadow-sm ring-1 ring-ink/15 placeholder:text-ink-soft/70"
        />
        <MicButton disabled={busy} onText={(t, final) => setAnswer((cur) => (final ? `${cur ? `${cur} ` : ""}${t}`.trim() : cur))} />
      </div>
      {note && (
        <p className="shrink-0 rounded-2xl bg-warm px-3 py-1.5 text-base" role="status">
          {note}
        </p>
      )}
      <div className="grid shrink-0 grid-cols-[1fr_2fr] gap-2">
        <button type="button" className="btn btn-white text-lg" disabled={busy} onClick={() => next(true)}>
          とばす
        </button>
        <button type="button" className="btn btn-lamp text-lg" disabled={busy || !answer.trim()} onClick={() => next(false)}>
          {i + 1 >= PROFILE_MAX_TURNS ? "できあがり ✨" : "次へ ›"}
        </button>
      </div>
      <p className="shrink-0 text-center text-xs text-ink-soft">名前・住所・体のことは入れません。あとで自分で直せます。</p>
    </div>
  );
}
