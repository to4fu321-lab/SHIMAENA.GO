// 警報の日のお休みのお知らせ（spec v1.11）。ホーム・ひとりで・地図の上に出す。文は決まった文（AI は使わない）。
import { STORM_LINES, stormHeadline, stormStatus } from "@/lib/storm";

export default async function StormBanner() {
  const s = await stormStatus();
  if (!s.stopped) return null;
  return (
    <div role="alert" className="fixed inset-x-0 top-0 z-[3000] mx-auto max-w-md bg-ink px-4 py-3 text-white shadow-lg">
      <p className="text-lg font-bold leading-snug">⛔ {stormHeadline(s)}</p>
      <p className="text-base leading-snug">
        {STORM_LINES[0]}
        {STORM_LINES[1]}
      </p>
      <p className="text-sm opacity-80">{STORM_LINES[2]}</p>
    </div>
  );
}
