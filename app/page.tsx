import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 bg-paper px-4 py-16 text-center text-ink">
      <p className="text-sm font-bold tracking-widest text-neon">Built with Claude: Japan 2026</p>
      <h1 className="text-4xl font-bold">
        シマエナ<span className="text-neon">GO</span>
      </h1>
      <p className="text-xl">寒い冬は、くっついて乗り切る。</p>
      <p className="max-w-md text-ink/80">雪の朝、町内のみんなで、ひとり暮らしの家の雪かきをするゲーム。</p>
      <nav className="grid w-full max-w-sm gap-3">
        <Link href="/rules" className="rounded-2xl bg-neon py-4 text-lg font-bold text-white">
          あそびかた
        </Link>
        <Link href="/map" className="rounded-2xl bg-ink py-4 text-lg font-bold text-white">
          地図を見る
        </Link>
        <Link href="/admin" className="rounded-2xl py-3 text-base text-ink/70 underline">
          デモ操作（審査・撮影用）
        </Link>
      </nav>
    </main>
  );
}
