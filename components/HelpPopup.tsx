"use client";

// 「バトンとは？」「なかまとは？」の説明ポップアップ（11/7 本人の指示「画面は変えずポップアップで、視覚的にも分かりやすく」）。
// 小さな「？」ボタンを押すと、下から説明の紙が出る。3つの流れを絵（絵文字）と矢印で見せ、安心できることを添える。
// 画面の中身はそのまま。閉じれば元の画面に戻る（何も保存しない）。
import { useEffect, useState, type ReactNode } from "react";
import Mascot from "./Mascot";

export type HelpTopic = "baton" | "nakama";

interface Step {
  icon: string;
  title: string;
  sub: string;
}

interface HelpContent {
  emoji: string;
  title: string;
  /** 一言でいうと */
  lead: ReactNode;
  steps: Step[];
  /** 画面の数字などの意味（なければ出さない） */
  terms?: { label: string; text: string }[];
  /** 安心できること */
  safe: string[];
}

const CONTENT: Record<HelpTopic, HelpContent> = {
  baton: {
    emoji: "🎽",
    title: "バトンとは？",
    lead: (
      <>
        雪かきの<b>「つづき」</b>を、同じ地域の<b>次の人へつなぐ合図</b>。駅伝のタスキのように。
      </>
    ),
    steps: [
      { icon: "⛏️", title: "雪かきをする", sub: "自分の家の前や道" },
      { icon: "🎽", title: "バトンを渡す", sub: "「ここまで」「途中まで」＋ひとこと" },
      { icon: "🙏", title: "次の人に届く", sub: "同じ地域の人から「ありがとう」" },
    ],
    terms: [
      { label: "この地域", text: "約250m四方のご近所。家は分かりません" },
      { label: "今日○人", text: "今日ここで雪かきした人の数" },
    ],
    safe: ["名前と家の場所は出ません", "返事はいりません。見るだけでも大丈夫", "渡せるのは1日3回まで"],
  },
  nakama: {
    emoji: "👥",
    title: "なかまとは？",
    lead: (
      <>
        近くの人と<b>10分だけ一緒に雪かき</b>する<b>ゆるい仲間</b>。ひとりでも、もちろん大丈夫。
      </>
    ),
    steps: [
      { icon: "🐦", title: "スタイルを選ぶ", sub: "誰かと・前回の仲間と・新しい人と" },
      { icon: "📩", title: "誘い合う", sub: "「一緒にやる」と答えたら決まる" },
      { icon: "🤝", title: "10分だけ一緒に", sub: "終わったら「なかま帳」に残る" },
    ],
    terms: [
      { label: "仲間", text: "一緒に雪かきをした人の数" },
      { label: "合流", text: "誰かと一緒にやった回数" },
      { label: "ありがとう", text: "あなたのバトンへのお礼の数" },
    ],
    safe: ["断っても何も減りません", "決まるまで、名前と家の場所は出ません", "夜は合流をお休み（防犯のため）"],
  },
};

/** 説明の紙（下から出る）。open のときだけ描く */
export function HelpPopup({ topic, onClose }: { topic: HelpTopic; onClose: () => void }) {
  const c = CONTENT[topic];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1300] flex items-end justify-center bg-ink/50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={c.title} onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-3xl bg-paper text-ink shadow-2xl"
        style={{ fontSize: 18, animation: "help-rise 0.25s ease-out both" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-ink/20" aria-hidden="true" />
        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 pb-1 pt-1">
          {/* 見出し: 隊長と一言 */}
          <div className="flex items-center gap-3">
            <Mascot size={60} mood="happy" className="shrink-0" />
            <div className="min-w-0 leading-tight">
              <h2 className="text-2xl font-bold">
                {c.emoji} {c.title}
              </h2>
              <p className="pt-1 text-base leading-snug text-ink-soft [@media(max-height:700px)]:text-[15px]">{c.lead}</p>
            </div>
          </div>

          {/* 3つの流れ: 絵 → 絵 → 絵 */}
          <ol className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-start gap-1" aria-label="流れ">
            {c.steps.map((s, i) => (
              <StepCell key={s.title} step={s} n={i + 1} last={i === c.steps.length - 1} />
            ))}
          </ol>

          {/* 画面の言葉の意味 */}
          {c.terms && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 rounded-2xl bg-ice-soft px-3 py-2 text-base leading-snug [@media(max-height:700px)]:text-[15px]">
              {c.terms.map((t) => (
                <div key={t.label} className="contents">
                  <dt className="whitespace-nowrap font-bold">{t.label}</dt>
                  <dd className="text-ink-soft">{t.text}</dd>
                </div>
              ))}
            </dl>
          )}

          {/* 安心できること */}
          <ul className="space-y-1 rounded-2xl bg-camellia-soft px-3 py-2 text-base leading-snug ring-1 ring-camellia [@media(max-height:700px)]:text-[15px]" aria-label="安心できること">
            {c.safe.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="shrink-0" aria-hidden="true">
                  🛡️
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="shrink-0 px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-1">
          <button onClick={onClose} className="btn btn-ink min-h-12 w-full text-lg">
            わかった
          </button>
        </div>
      </div>
      <style>{`@keyframes help-rise { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }`}</style>
    </div>
  );
}

function StepCell({ step, n, last }: { step: Step; n: number; last: boolean }) {
  return (
    <>
      <li className="flex flex-col items-center gap-1 text-center">
        <span className="relative grid size-14 place-items-center rounded-full bg-card text-3xl shadow-sm ring-2 ring-ink/15">
          <span aria-hidden="true">{step.icon}</span>
          <span className="absolute -left-1 -top-1 grid size-6 place-items-center rounded-full bg-lamp text-sm font-bold text-white">{n}</span>
        </span>
        <span className="whitespace-nowrap text-sm font-bold leading-tight max-[400px]:text-[13px]">{step.title}</span>
        <span className="text-xs leading-snug text-ink-soft">{step.sub}</span>
      </li>
      {!last && (
        <span className="pt-4 text-2xl text-ink/40" aria-hidden="true">
          ›
        </span>
      )}
    </>
  );
}

/** 画面に置く小さな「？」。押すと説明の紙が開く。label があれば「？ なかまとは」のように文字つき。compact は角に置く小さい丸 */
export default function HelpButton({
  topic,
  label,
  light = false,
  compact = false,
  className = "",
}: {
  topic: HelpTopic;
  label?: string;
  light?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const c = CONTENT[topic];
  const size = label ? "min-h-9 px-3" : compact ? "size-7" : "size-9";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label={label ? undefined : c.title}
        className={`flex shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-full text-sm font-bold ring-1 ${size} ${
          light ? "bg-white/15 text-white ring-white/50" : "bg-card text-ink-soft ring-ink/20"
        } ${className}`}
      >
        <span className={`grid place-items-center rounded-full bg-current leading-none ${compact ? "size-4 text-[11px]" : "size-5 text-[13px]"}`} aria-hidden="true">
          <span className={light ? "text-ink" : "text-paper"}>?</span>
        </span>
        {label}
      </button>
      {open && <HelpPopup topic={topic} onClose={() => setOpen(false)} />}
    </>
  );
}
