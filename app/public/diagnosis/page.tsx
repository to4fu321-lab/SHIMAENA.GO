// シマエナ診断（spec v1.3）。登録なしで遊べる5問 → 5タイプ。結果は ?r=タイプ で共有でき、結果の画像から LINE 参加・ソロ出動へ。
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import Quiz from "@/components/Quiz";
import SnsShare from "@/components/SnsShare";
import { quizComment } from "@/lib/claude/quiz";
import { lineJoinUrl } from "@/lib/line/join";
import { loadMorning } from "@/lib/morning/store";
import { appToday } from "@/lib/morning/today";
import { isQuizType, QUIZ_TYPES } from "@/lib/public/quiz";
import { baseUrl } from "@/lib/url";

export const metadata: Metadata = {
  title: "シマエナ診断 ・ シマエナGO",
  description: "あなたは何シマエナ？ 5つの質問で、あなたに向いている10分の出動が分かります。登録なしで遊べます。",
};

async function Diagnosis({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  await connection();
  const { r } = await searchParams;
  if (!isQuizType(r)) return <Quiz />;
  const t = QUIZ_TYPES[r];
  const comment = await quizComment(r, appToday(await loadMorning()));
  const join = lineJoinUrl();
  const site = baseUrl();
  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-3xl bg-card p-5 text-center shadow-sm ring-1 ring-ink/10" aria-label="診断の結果">
        <p className="text-base text-ink-soft">あなたは…</p>
        <h2 className="text-3xl font-bold text-camellia-deep">{t.name}</h2>
        <p className="text-lg font-bold">{t.catchphrase}</p>
        <p className="text-left">{t.description}</p>
        <p className="rounded-2xl bg-warm px-3 py-2 text-left text-base">
          <span className="block eyebrow">シマエナ隊長から</span>
          {comment.text}
        </p>
        <p className="rounded-2xl bg-ice-soft px-3 py-2 text-left text-base">
          おすすめの10分: <b>{t.mission}</b>
        </p>
      </section>
      <section className="space-y-3 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-ink/10">
        <h2 className="text-xl font-bold">ソロ出動で、さっそく10分</h2>
        <p>シマエナGO は、雪の朝に町内でくっついて雪をどける雪かきゲームです。仲間がいない日も、1人の10分（ソロ出動）から参加できます。</p>
        <Link href={join} className="btn btn-big bg-lamp text-white">
            はじめる（30秒で登録）
          </Link>
        <Link href="/public/town" className="btn btn-ink btn-big">
          町の雪解けを見る
        </Link>
        <Link href="/public/diagnosis" className="btn btn-white text-base">
          もう一度診断する
        </Link>
      </section>
      <SnsShare
        title="結果を SNS でシェア"
        options={[
          {
            key: `quiz-${r}`,
            label: t.name,
            text: `シマエナ診断の結果は「${t.name}」！\n${t.catchphrase}\nあなたは何シマエナ？\n#シマエナGO #シマエナ診断`,
            image: `/api/share/quiz-${r}.png`,
            page: `${site}/public/share/quiz-${r}?via=sns`,
          },
        ]}
      />
    </div>
  );
}

export default function DiagnosisPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-4 bg-paper px-4 pb-8 pt-5 text-ink">
      <header className="text-center">
        <p className="eyebrow">登録なしで遊べます</p>
        <h1 className="text-3xl font-bold">
          シマエナ<span className="text-camellia-deep">診断</span>
        </h1>
        <p className="text-base text-ink-soft">あなたは何シマエナ？ 5つの質問で、向いている10分が分かります。</p>
      </header>
      <Suspense fallback={<p className="text-center">読み込み中…</p>}>
        <Diagnosis searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
