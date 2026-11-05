// SNS のリンク先（spec v1.3）。LINE 登録前でも見られる。画像は /api/share/<kind>.png（集計だけ、名前や家は出さない）。
// X などがリンクの見出し画像（OG）を取りに来るので、params だけで作れる静的なページにしている。
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { lineJoinUrl } from "@/lib/line/join";
import { QUIZ_TYPES } from "@/lib/public/quiz";

const PAGES = {
  today: { title: "今日のシマエナGO 出動", description: "雪の朝、町内のシマエナが家の雪をどけています。今日の出動人数と雪解けの進み。" },
  town: { title: "しらかば町内の雪解け", description: "町の雪解け率・助けた家・今週の活動人数。あなたの町にもシマエナを。" },
  recruit: { title: "10分だけ参加しませんか？", description: "人手が足りない家があります。あなたの10分で町が変わる。" },
  // シマエナ診断の結果（quiz-asa など）
  ...Object.fromEntries(
    Object.values(QUIZ_TYPES).map((t) => [`quiz-${t.type}`, { title: `シマエナ診断: ${t.name}`, description: `${t.catchphrase} あなたは何シマエナ？ 5つの質問で分かります。` }]),
  ),
} as Record<string, { title: string; description: string }>;
type Kind = string;

export function generateStaticParams() {
  return Object.keys(PAGES).map((kind) => ({ kind }));
}

export async function generateMetadata({ params }: { params: Promise<{ kind: string }> }): Promise<Metadata> {
  const { kind } = await params;
  const p = PAGES[kind as Kind];
  if (!p) return {};
  const image = `/api/share/${kind}.png?format=og`;
  return {
    title: `${p.title} ・ シマエナGO`,
    description: p.description,
    openGraph: { title: p.title, description: p.description, images: [{ url: image, width: 1200, height: 630 }], type: "website" },
    twitter: { card: "summary_large_image", title: p.title, description: p.description, images: [image] },
  };
}

export default async function SharePage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const p = PAGES[kind as Kind];
  if (!p) notFound();
  const join = lineJoinUrl();
  return (
    <main className="mx-auto min-h-dvh max-w-md space-y-5 bg-paper px-4 py-6 text-ink">
      <header className="text-center">
        <h1 className="text-3xl font-bold">
          シマエナ<span className="text-camellia-deep">GO</span>
        </h1>
        <p className="text-base text-ink-soft">寒い冬は、くっついて乗り切る。</p>
      </header>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/share/${kind}.png?format=square`} alt={p.title} className="aspect-square w-full rounded-3xl shadow-sm ring-1 ring-ink/10" />
      <section className="space-y-3 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-ink/10">
        <h2 className="text-xl font-bold">{p.title}</h2>
        <p>{p.description}</p>
        <p>
          雪の朝に LINE で点呼が届き、町内の3チームがひとり暮らしの家の雪をどける雪かきゲームです。仲間がいない日も、
          <b>ソロ出動</b>（自分の家の雪かき・道の危険の報告）で、1人の10分から参加できます。
        </p>
        {join ? (
          <a href={`${join}`} className="btn btn-big bg-[#06C755] text-white">
            LINE で参加する
          </a>
        ) : (
          <p className="rounded-2xl bg-paper px-3 py-2 text-base">LINE で「シマエナGO」を検索して友だち追加 → 登録（1分）</p>
        )}
        {kind.startsWith("quiz-") && (
          <Link href="/public/diagnosis" className="btn btn-ink btn-big">
            あなたも診断する
          </Link>
        )}
        <Link href="/public/town?via=sns" className="btn btn-ink btn-big">
          町の雪解けを見る
        </Link>
        <Link href="/rules" className="btn btn-white text-base">
          使い方
        </Link>
      </section>
    </main>
  );
}
