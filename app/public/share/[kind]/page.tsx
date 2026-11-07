// SNS のリンク先（spec v1.3）。登録前でも見られる。画像は /api/share/<kind>.png（集計だけ、名前や家は出さない）。
// X などがリンクの見出し画像（OG）を取りに来るので、params だけで作れる静的なページにしている。
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Mascot from "@/components/Mascot";
import { lineJoinUrl } from "@/lib/line/join";
import { QUIZ_TYPES } from "@/lib/public/quiz";

const PAGES = {
  today: { title: "今日のシマエナGO 出動", description: "雪の朝、エリアのシマエナが家の雪をどけています。今日の出動人数と雪解けの進み。" },
  town: { title: "しらかばエリアの雪解け", description: "町の雪解け率・助けた家・今週の活動人数。あなたの町にもシマエナを。" },
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
    // SNS から来た人が最初に見る画面: 画像 → 「はじめる」をスクロールなしで（11/7 UI 点検: 前は説明が長くてボタンが下に隠れていた）
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-3 bg-paper px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 text-ink">
      <header className="flex items-center gap-3">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-card shadow-sm">
          <Mascot size={40} />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="text-2xl font-bold">
            シマエナ<span className="text-lamp-deep">GO</span>
          </p>
          <p className="truncate text-sm font-bold text-ink-soft">寒い冬は、くっついて乗り切る。</p>
        </div>
      </header>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/share/${kind}.png?format=square`} alt={p.title} className="mx-auto aspect-square w-full max-w-[min(100%,42dvh)] rounded-3xl shadow-md ring-1 ring-ink/10" />
      <section className="space-y-2 rounded-3xl bg-card p-4 shadow-sm ring-1 ring-ink/10">
        <h1 className="text-xl font-bold leading-tight">{p.title}</h1>
        <p className="text-base leading-snug text-ink-soft">{p.description}</p>
        <Link href={join} className="btn btn-lamp btn-big w-full">
          はじめる（30秒で登録）
        </Link>
        <div className="grid grid-cols-2 gap-2">
          {kind.startsWith("quiz-") ? (
            <Link href="/public/diagnosis" className="btn btn-ink whitespace-nowrap text-sm">
              あなたも診断する
            </Link>
          ) : (
            <Link href="/rules" className="btn btn-white whitespace-nowrap text-sm">
              使い方
            </Link>
          )}
          <Link href="/public/town?via=sns" className="btn btn-ink whitespace-nowrap text-sm">
            町の雪解けを見る
          </Link>
        </div>
      </section>
      <p className="px-1 text-sm leading-snug text-ink-soft">
        雪の朝に点呼が届き、エリアの3チームがひとり暮らしの家の雪をどける雪かきゲーム。仲間がいない日も<b>ソロ出動</b>（自分の家の雪かき・道の危険の報告）で、1人の10分から。
      </p>
    </main>
  );
}
