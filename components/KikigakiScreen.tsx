"use client";

// 雪の聞き書き（spec v1.26）の画面。はじめに → 隊長が1問ずつ聞く（読み上げ・声で答える）→ お話を書いて絵を描く（待つ演出）
// → 雪がとけるように絵が現れ、題名とお話が出る → 「来てくれた人に届ける／自分だけにしておく」。1画面に収める（絵とお話は切りかえ）。
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Mascot from "./Mascot";
import MicButton from "./MicButton";
import { canSpeak, speak } from "./ChatTools";
import { useClientValue } from "./useClientValue";
import { finishAction, nextQuestionAction, shareAction } from "@/app/kikigaki/actions";
import { MAX_TURNS, MIN_ANSWERS, OPENING, type Turn } from "@/lib/kikigaki/core";
import type { StoryView } from "@/lib/kikigaki/view";
import { play } from "@/lib/sound/engine";

type Stage = "intro" | "talk" | "writing" | "reveal";

const WRITING = ["お話を書いています…", "思い出の場面を思いうかべています…", "絵の下書きをしています…", "描いた絵を見直しています…", "仕上げています。もうすぐです…"];

export default function KikigakiScreen({ viewerId, nickname, existing }: { viewerId: string; nickname: string; existing?: StoryView }) {
  const [stage, setStage] = useState<Stage>("intro");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState("");
  const [aizuchi, setAizuchi] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const [story, setStory] = useState<StoryView | undefined>(existing);
  const [view, setView] = useState<"picture" | "story">("picture");
  const [revealKey, setRevealKey] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [writingIdx, setWritingIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const speakable = useClientValue(false, canSpeak);
  const base = useRef("");

  const say = (text: string) => {
    if (voiceOn && speakable) speak(text);
  };

  // 書いている間の言葉と時間
  useEffect(() => {
    if (stage !== "writing") return;
    const started = Date.now();
    const t = window.setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000);
      setElapsed(s);
      setWritingIdx(Math.min(WRITING.length - 1, Math.floor(s / 12)));
    }, 1000);
    return () => window.clearInterval(t);
  }, [stage]);

  const answeredCount = turns.filter((t) => t.a.trim()).length;

  const ask = async (sofar: Turn[]) => {
    setBusy(true);
    setNote(undefined);
    try {
      const r = await nextQuestionAction(viewerId, sofar);
      if (!r.ok) {
        setNote(r.text);
        return;
      }
      if (!r.question) {
        await finish(sofar);
        return;
      }
      setAizuchi(r.aizuchi ?? "");
      setQuestion(r.question);
      setAnswer("");
      base.current = "";
      setStage("talk");
      play("chirp");
      say(`${r.aizuchi ?? ""}${sofar.length === 0 ? OPENING : ""}${r.question}`);
    } finally {
      setBusy(false);
    }
  };

  const submit = async (skip = false) => {
    if (busy) return;
    const a = skip ? "" : answer.trim();
    if (!skip && !a) {
      setNote("声か文字で答えてください。答えにくければ「とばす」でも大丈夫です。");
      return;
    }
    const next = [...turns, { q: question, a }];
    setTurns(next);
    play(skip ? "back" : "send");
    if (next.length >= MAX_TURNS) await finish(next);
    else await ask(next);
  };

  const finish = async (all: Turn[]) => {
    if (all.filter((t) => t.a.trim()).length < MIN_ANSWERS) {
      setNote(`あと少しだけ聞かせてください（${MIN_ANSWERS}つ答えるとお話にできます）。`);
      return;
    }
    if (typeof window !== "undefined" && canSpeak()) window.speechSynthesis.cancel();
    setStage("writing");
    setElapsed(0);
    setWritingIdx(0);
    setBusy(true);
    try {
      // 書いている時間も「間」のうち: 早く終わっても 4 秒は待つ（すぐ出ると、心をこめて書いた感じがしない）
      const [r] = await Promise.all([finishAction(viewerId, all), new Promise((res) => setTimeout(res, 4000))]);
      if (!r.ok || !r.story) {
        setNote(r.text ?? "お話にできませんでした。もう一度お試しください。");
        setStage("talk");
        return;
      }
      setStory(r.story);
      setView("picture");
      setRevealKey((k) => k + 1);
      setStage("reveal");
      play("cardSparkle");
      play("cardChime", { delay: 1.6 });
    } catch {
      setNote("通信がうまくいきませんでした。もう一度お試しください。");
      setStage("talk");
    } finally {
      setBusy(false);
    }
  };

  const choose = async (share: boolean) => {
    setBusy(true);
    try {
      const r = await shareAction(viewerId, share);
      setNote(r.text);
      if (r.ok && story) setStory({ ...story, share });
      play(share ? "thanks" : "toggleOff");
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setTurns([]);
    setNote(undefined);
    void ask([]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <style>{CSS}</style>

      {stage === "intro" && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="kg-snow relative grid flex-1 place-items-center overflow-hidden rounded-3xl bg-[#2b3a6b] text-white">
            <div className="relative z-10 flex flex-col items-center gap-2 px-5 text-center">
              <Mascot size={110} />
              <p className="text-2xl font-bold leading-snug">{nickname}、雪の思い出を聞かせてください</p>
              <p className="text-lg leading-snug opacity-90">隊長が、ひとつずつ聞きます。声でも、文字でも。できたお話は、絵本の1ページになります。</p>
            </div>
          </div>
          <p className="text-base leading-snug text-ink-soft">名前や住所はお話に入れません。体のことは聞きません。届けるかどうかは、最後にあなたが決めます。</p>
          <button type="button" className="btn btn-lamp btn-big w-full" disabled={busy} onClick={restart}>
            {busy ? "隊長が来ています…" : "🎙 はじめる（5つの質問）"}
          </button>
          {existing && (
            <button type="button" className="btn btn-white w-full text-lg" onClick={() => { setStory(existing); setView("picture"); setRevealKey((k) => k + 1); setStage("reveal"); }}>
              📖 前のお話「{existing.title}」を見る
            </button>
          )}
        </div>
      )}

      {stage === "talk" && (
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <ol className="flex gap-1.5" aria-label={`${turns.length + 1} 問目 / ${MAX_TURNS}`}>
              {Array.from({ length: MAX_TURNS }, (_, i) => (
                <li key={i} className={`grid size-7 place-items-center rounded-full text-sm ${i < turns.length ? "bg-ice text-white" : i === turns.length ? "bg-lamp text-white" : "bg-ice-soft text-ink-soft"}`}>
                  ❄
                </li>
              ))}
            </ol>
            {speakable && (
              <button type="button" className="btn btn-white min-h-10 px-3 text-sm" aria-pressed={voiceOn} onClick={() => setVoiceOn((v) => !v)}>
                {voiceOn ? "🔊 読み上げ" : "🔈 読まない"}
              </button>
            )}
          </div>
          <div key={question} className="kg-bubble flex gap-2">
            <Mascot size={56} className="shrink-0" />
            <div className="min-w-0 flex-1 rounded-3xl rounded-tl-md bg-card p-3.5 shadow-sm ring-1 ring-ink/10">
              {aizuchi && <p className="mb-1 text-base leading-snug text-ink-soft">{aizuchi}</p>}
              <p className="text-[22px] font-bold leading-snug short:text-xl">{question}</p>
              {speakable && (
                <button type="button" className="mt-1 text-base text-lamp-deep underline" onClick={() => speak(`${aizuchi}${question}`)}>
                  もう一度聞く
                </button>
              )}
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div className="flex min-h-0 flex-1 items-start gap-2">
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="ここに答えるか、🎤 を押して話してください"
                className="h-full min-h-24 w-full flex-1 resize-none rounded-2xl bg-card p-3 text-xl leading-snug shadow-inner ring-1 ring-ink/15"
                maxLength={300}
                aria-label="答え"
              />
              <MicButton
                disabled={busy}
                onText={(text, final) => {
                  setAnswer(`${base.current}${text}`);
                  if (final) base.current = `${base.current}${text}`;
                }}
              />
            </div>
            {note && <p className="text-base text-alert">{note}</p>}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <button type="button" className="btn btn-lamp btn-big" disabled={busy} onClick={() => void submit(false)}>
                {busy ? "…" : turns.length + 1 >= MAX_TURNS ? "答えて、お話にする" : "答える"}
              </button>
              <button type="button" className="btn btn-white min-h-16 px-4 text-lg" disabled={busy} onClick={() => void submit(true)}>
                とばす
              </button>
            </div>
            {answeredCount >= MIN_ANSWERS && turns.length + 1 < MAX_TURNS && (
              <button type="button" className="text-base text-lamp-deep underline" disabled={busy} onClick={() => void finish(answer.trim() ? [...turns, { q: question, a: answer.trim() }] : turns)}>
                ここまでで、お話にしてもらう
              </button>
            )}
          </div>
        </div>
      )}

      {stage === "writing" && (
        <div className="kg-snow relative grid flex-1 place-items-center overflow-hidden rounded-3xl bg-[#2b3a6b] text-white" role="status" aria-live="polite">
          <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
            <div className="kg-quill">
              <Mascot size={120} mood="happy" />
            </div>
            <p key={writingIdx} className="kg-fade text-2xl font-bold leading-snug">{WRITING[writingIdx]}</p>
            <p className="text-base opacity-80">話してくれたことから、隊長がお話を書き、絵を描いています（1〜3分）。{elapsed > 0 ? ` ${elapsed} 秒` : ""}</p>
          </div>
        </div>
      )}

      {stage === "reveal" && story && (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="grid grid-cols-2 gap-1 rounded-full bg-ice-soft p-1" role="tablist">
            {(["picture", "story"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                className={`min-h-11 rounded-full text-lg font-bold ${view === v ? "bg-card shadow-sm" : "text-ink-soft"}`}
                onClick={() => setView(v)}
              >
                {v === "picture" ? "🖼 絵" : "📖 お話"}
              </button>
            ))}
          </div>
          <div className="relative flex min-h-0 flex-1 flex-col">
            {view === "picture" ? (
              <div key={`p${revealKey}`} className="flex min-h-0 flex-1 flex-col items-center gap-2">
                <div className="grid min-h-0 w-full flex-1 place-items-center">
                  <div className="kg-reveal relative aspect-[27/28] h-full max-h-full max-w-full overflow-hidden rounded-3xl bg-card shadow-md ring-1 ring-ink/10">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={story.image} alt={`「${story.title}」の絵`} className="kg-picture h-full w-full object-cover" />
                    <div className="kg-melt pointer-events-none absolute inset-0" aria-hidden="true" />
                  </div>
                </div>
                <p className="kg-title text-center text-2xl font-bold">「{story.title}」</p>
                <button type="button" className="text-base text-lamp-deep underline" onClick={() => setView("story")}>
                  お話を読む →
                </button>
              </div>
            ) : (
              <div className="kg-paper flex min-h-0 flex-1 flex-col gap-2 rounded-3xl p-4 shadow-md ring-1 ring-ink/10">
                <p className="text-2xl font-bold">「{story.title}」</p>
                <p className="kg-lines min-h-0 flex-1 overflow-hidden text-[19px] leading-[1.85] short:text-lg short:leading-relaxed">{story.story}</p>
                <div className="flex items-center justify-between text-sm text-ink-soft">
                  <span>{story.by === "claude" ? "お話と絵: シマエナ隊長（Claude）" : "お話: あなたの言葉から"}</span>
                  {speakable && (
                    <button type="button" className="text-base text-lamp-deep underline" onClick={() => speak(`${story.title}。${story.story}`)}>
                      🔊 読んでもらう
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          {note && <p className="text-base font-bold text-lamp-deep">{note}</p>}
          <div className="grid grid-cols-1 gap-2">
            <button type="button" className={`btn btn-big w-full ${story.share ? "btn-ink" : "btn-lamp"}`} disabled={busy} onClick={() => void choose(true)}>
              {story.share ? "✓ 来てくれた人に届けます" : "雪かきに来てくれた人に届ける"}
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={`btn min-h-12 text-base ${!story.share ? "btn-ink" : "btn-white"}`} disabled={busy} onClick={() => void choose(false)}>
                {!story.share ? "✓ 自分だけ" : "自分だけにする"}
              </button>
              <Link href="/" className="btn btn-white min-h-12 text-base">
                ホームへ
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.kg-snow::before, .kg-snow::after {
  content: ""; position: absolute; inset: -40px 0 0; pointer-events: none;
  background-image: radial-gradient(3px 3px at 20px 30px, #fff 60%, transparent 61%), radial-gradient(2px 2px at 80px 120px, #fff 60%, transparent 61%),
    radial-gradient(3px 3px at 150px 60px, #fff 60%, transparent 61%), radial-gradient(2px 2px at 220px 160px, #fff 60%, transparent 61%),
    radial-gradient(2.5px 2.5px at 300px 90px, #fff 60%, transparent 61%), radial-gradient(2px 2px at 340px 200px, #fff 60%, transparent 61%);
  background-size: 360px 240px; opacity: .8; animation: kg-fall 9s linear infinite;
}
.kg-snow::after { background-size: 260px 200px; opacity: .5; animation-duration: 14s; }
@keyframes kg-fall { to { transform: translateY(240px); } }
.kg-bubble { animation: kg-in .5s ease-out both; }
@keyframes kg-in { from { opacity: 0; transform: translateY(10px); } }
.kg-quill { animation: kg-bob 2.4s ease-in-out infinite; }
@keyframes kg-bob { 50% { transform: translateY(-8px) rotate(-4deg); } }
.kg-fade { animation: kg-in .8s ease-out both; }
.kg-picture { animation: kg-focus 2.6s ease-out both; }
@keyframes kg-focus { from { filter: blur(14px) saturate(.2) brightness(1.4); transform: scale(1.06); } to { filter: none; transform: none; } }
.kg-melt { background: linear-gradient(180deg, #ffffff 0%, #f4f9ff 45%, rgba(255,255,255,0) 60%); background-size: 100% 260%; animation: kg-melt 2.6s ease-in both; }
@keyframes kg-melt { from { background-position: 0 0; } to { background-position: 0 100%; opacity: 0; } }
.kg-title { animation: kg-in .9s ease-out 1.8s both; }
.kg-paper { background: linear-gradient(180deg, #fffaf0, #fbf3e4); }
.kg-lines { animation: kg-in 1.2s ease-out both; }
@media (prefers-reduced-motion: reduce) {
  .kg-snow::before, .kg-snow::after, .kg-bubble, .kg-quill, .kg-fade, .kg-picture, .kg-melt, .kg-title, .kg-lines { animation: none; }
  .kg-melt { display: none; }
}
`;
