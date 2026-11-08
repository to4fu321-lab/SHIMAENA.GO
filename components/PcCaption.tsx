import Mascot from "@/components/Mascot";

/** PC 表示（幅 1024px 以上）で、スマホ枠の左の空きに出す案内。スマホでは出ない。印刷ページ（/book/print）では globals.css が隠す */
export default function PcCaption() {
  return (
    <aside
      className="pc-caption pointer-events-none fixed inset-y-0 left-0 z-0 hidden w-[calc((100vw-28rem)/2)] flex-col items-center justify-center gap-4 px-8 text-center text-white lg:flex"
      aria-label="PC で見ている人への案内"
    >
      <Mascot size={96} />
      <p className="text-3xl font-black tracking-wide drop-shadow">
        シマエナ<span className="text-lamp">GO</span>
      </p>
      <p className="text-lg font-bold">寒い冬は、くっついて乗り切る。</p>
      <p className="max-w-xs text-base leading-relaxed text-white/85">
        スマホで使うアプリです。PC では真ん中の画面をそのまま操作できます。
        スマホで開くと、通知とホーム画面への追加も使えます。
      </p>
    </aside>
  );
}
