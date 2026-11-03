"use client";

// シマエナ診断の5問（登録なし）。1問ずつ大きなボタンで答え、終わったら結果の URL（?r=タイプ）へ。
import { useRouter } from "next/navigation";
import { useState } from "react";
import { QUIZ_CHOICES, QUIZ_QUESTIONS, quizResult, type QuizAnswer } from "@/lib/public/quiz";

export default function Quiz() {
  const router = useRouter();
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const i = answers.length;
  const q = QUIZ_QUESTIONS[i];

  const answer = (a: QuizAnswer) => {
    const next = [...answers, a];
    if (next.length >= QUIZ_QUESTIONS.length) router.push(`/public/diagnosis?r=${quizResult(next)}`);
    else setAnswers(next);
  };

  if (!q) return <p className="text-center text-lg">結果を出しています…</p>;
  return (
    <section className="space-y-4 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-ink/10" aria-label="シマエナ診断">
      <p className="eyebrow">
        しつもん {i + 1} / {QUIZ_QUESTIONS.length}
      </p>
      <span className="block h-3 overflow-hidden rounded-full bg-ice-soft" aria-hidden="true">
        <span className="block h-full rounded-full bg-ice transition-[width]" style={{ width: `${(i / QUIZ_QUESTIONS.length) * 100}%` }} />
      </span>
      <h2 className="text-2xl font-bold">{q.text}</h2>
      <div className="grid gap-3">
        {QUIZ_CHOICES.map((c) => (
          <button key={c.value} onClick={() => answer(c.value)} className="btn btn-ink btn-big">
            {c.label}
          </button>
        ))}
      </div>
      {i > 0 && (
        <button onClick={() => setAnswers(answers.slice(0, -1))} className="btn btn-white w-full text-base">
          ひとつ前の質問に戻る
        </button>
      )}
    </section>
  );
}
