export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-sm tracking-wide text-accent font-bold">
        Built with Claude: Japan 2026
      </p>
      <h1 className="mt-4 text-3xl font-bold leading-snug sm:text-4xl">
        提出作品（準備中）
      </h1>
      <p className="mt-6 max-w-xl text-balance">
        Anthropic × Cerebral Valley 主催のハッカソンに向けて、
        11月2日〜11月8日の期間中に制作しています。
        テーマと機能は決まり次第ここに反映します。
      </p>
      <p className="mt-10 text-sm opacity-70">
        Next.js + Claude API ／ 公開リポジトリ: GitHub
      </p>
    </main>
  );
}
