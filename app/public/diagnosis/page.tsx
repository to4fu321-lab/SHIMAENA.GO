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
  description: "あなたは何シマエナ？ 5つの質問で、あなたに向いている5分の出動が分かります。登録なしで遊べます。",
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
      <section className="space-y-3 rounded-3xl bg-white p-5 text-center shadow-sm ring-1 ring-ink/10" aria-label="診断の結果">
        <p className="text-base text-ink/70">あなたは…</p>
        <h2 className="text-3xl font-bold text-neon">{t.name}</h2>
        <p className="text-lg font-bold">{t.catchphrase}</p>
        <p className="text-left">{t.description}</p>
        <p className="rounded-2xl bg-[#fff0f6] px-3 py-2 text-left text-base">
          <span className="block text-xs font-bold tracking-widest text-neon">エナガ隊長から</span>
          {comment.text}
        </p>
        <p className="rounded-2xl bg-paper px-3 py-2 text-left text-base">
          おすすめの5分: <b>{t.mission}</b>
        </p>
      </section>
      <section className="space-y-3 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/10">
        <h2 className="text-xl font-bold">ソロ出動で、さっそく5分</h2>
        <p>シマエナGO は、雪の朝に町内でくっついて雪をどける雪かきゲームです。仲間がいない日も、1人の5分（ソロ出動）から参加できます。</p>
        {join ? (
          <a href={join} className="block rounded-2xl bg-[#06C755] py-4 text-center text-xl font-bold text-white">
            LINE で参加する
          </a>
        ) : (
          <p className="rounded-2xl bg-paper px-3 py-2 text-base">LINE で「シマエナGO」を検索して友だち追加 → 登録（1分）</p>
        )}
        <Link href="/public/town" className="block rounded-2xl bg-ink py-4 text-center text-lg font-bold text-white">
          町の雪解けを見る
        </Link>
        <Link href="/public/diagnosis" className="block text-center text-base underline">
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
        <p className="text-xs font-bold tracking-widest text-neon">登録なしで遊べます</p>
        <h1 className="text-3xl font-bold">
          シマエナ<span className="text-neon">診断</span>
        </h1>
        <p className="text-base text-ink/80">あなたは何シマエナ？ 5つの質問で、向いている5分が分かります。</p>
      </header>
      <Suspense fallback={<p className="text-center">読み込み中…</p>}>
        <Diagnosis searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
