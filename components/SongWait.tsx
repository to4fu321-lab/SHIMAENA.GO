"use client";

// 雪の歌の作曲中（spec v1.59）: 数秒ごとに「できた？」とだけ聞き、できたらこの画面を取り直して楽譜に切りかえる。
// 画面ごと取り直すと、そのたびに作曲を頼み直してしまうので（Claude のお金の守り）、できたかどうかだけを聞く。
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { songReadyAction } from "@/app/song/actions";
import { quietly } from "@/lib/ui/loading";

export default function SongWait({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  const [waited, setWaited] = useState(0);
  useEffect(() => {
    let stop = false;
    const t0 = Date.now();
    const clock = setInterval(() => setWaited(Math.round((Date.now() - t0) / 1000)), 1000);
    const poll = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      quietly(async () => {
        const ready = await songReadyAction().catch(() => false);
        if (ready && !stop) router.refresh();
      });
    }, seconds * 1000);
    return () => {
      stop = true;
      clearInterval(clock);
      clearInterval(poll);
    };
  }, [router, seconds]);
  return (
    <p className="flex items-center gap-2 rounded-2xl bg-ice-soft px-3 py-2 text-base font-bold" role="status">
      <span className="loading-spin inline-block size-5 shrink-0 rounded-full border-[3px] border-ink/20 border-t-ink" aria-hidden="true" />
      <span>
        このままお待ちください。できたら、この画面が自動で切りかわります。
        <span className="ml-1 font-normal tabular-nums text-ink-soft">（{waited}秒）</span>
      </span>
    </p>
  );
}
